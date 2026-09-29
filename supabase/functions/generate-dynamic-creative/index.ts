import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import {
  callOpenRouterWithCascade,
  generateImageWithCascade,
  imageFailurePayload,
  parseToolCall,
} from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { insertCreative } from "../_shared/creatives.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, imageToBytes, signStorageUrl, uploadGeneratedImage } from "../_shared/storage.ts";

/**
 * Generates creatives for the "Dinâmica" tab: text model writes a briefing,
 * image model renders it.
 *
 * The frontend now calls this once per creative (types: [{ type, count: 1 }])
 * so each request stays well under the ~150s Edge Function limit. Larger
 * batches are still accepted, but the function stops starting new items when
 * the time budget runs low and returns `truncated: true`.
 */

const TIME_BUDGET_MS = 120000;
/** A briefing + image usually needs well over a minute; don't start one with less than this left. */
const MIN_TIME_FOR_ITEM_MS = 75000;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const START_TS = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!Deno.env.get("OPENROUTER_API_KEY")) throw new Error("OpenRouter não configurado");

    const body = await req.json();
    const { projectId, types, format, ignoreBrandKit, ignoreContext, customPrompt } = body;
    const includeLogo = body.includeLogo !== false;
    if (!projectId || !types?.length) throw new Error("projectId e types são obrigatórios");

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const userId = authed.userId;
    const track = { functionName: "generate-dynamic-creative", projectId, userId };

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const db = adminClient();

    const selectedFormat = format || "1:1";

    // Fetch project context and brand kit
    const { data: project } = await anonClient.from("projects").select("context, voice_guide, name").eq("id", projectId).single();
    const { data: brandKit } = await anonClient.from("brand_kits").select("*").eq("project_id", projectId).maybeSingle();

    const typeToPromptId: Record<string, string> = {
      conservative: "dynamic-conservative",
      innovative: "dynamic-innovative",
      radical: "dynamic-radical",
    };

    const promptIds = types.map((t: any) => typeToPromptId[t.type]).filter(Boolean);
    const { data: prompts } = await anonClient.from("template_prompts").select("id, prompt, style_prompt").in("id", promptIds);
    const promptMap = new Map((prompts || []).map((p: any) => [p.id, { prompt: p.prompt, style_prompt: p.style_prompt || '' }]));

    const useBrandKit = !ignoreBrandKit && !!brandKit;
    const brandInfo = useBrandKit
      ? `Cores: primária ${brandKit.primary_color || "N/A"}, secundária ${brandKit.secondary_color || "N/A"}, fundo ${brandKit.background_color || "N/A"}. Tipografia: ${brandKit.typography || "N/A"}.`
      : "Sem brand kit definido.";

    // Logo from the brand kit (private bucket → signed URL for the AI provider)
    const logoUrl = useBrandKit && includeLogo ? await signStorageUrl(db, brandKit.logo_url) : null;

    const results: any[] = [];
    let truncated = false;
    let lastFailure: ReturnType<typeof imageFailurePayload> | null = null;

    outer:
    for (const { type, count } of types) {
      const promptData = promptMap.get(typeToPromptId[type]) || { prompt: "", style_prompt: "" };
      const basePrompt = promptData.prompt ? `COMPOSIÇÃO E LAYOUT:\n${promptData.prompt}${promptData.style_prompt ? `\n\nESTILO VISUAL E ESTÉTICA:\n${promptData.style_prompt}` : ''}` : "";
      const validCount = Math.min(Math.max(1, count), 5);

      for (let i = 0; i < validCount; i++) {
        if (results.length > 0 && TIME_BUDGET_MS - (Date.now() - START_TS) < MIN_TIME_FOR_ITEM_MS) {
          truncated = true;
          break outer;
        }

        // Step 1: Generate briefing
        const briefingResult = await callOpenRouterWithCascade({
          settingsKey: "text_reasoning",
          track,
          messages: [
            { role: "system", content: basePrompt },
            {
              role: "user",
              content: `Contexto do projeto "${project?.name || ""}":
${ignoreContext ? "Sem contexto definido." : (project?.context || "Sem contexto definido.")}

Tom de voz: ${ignoreContext ? "Não definido." : (project?.voice_guide || "Não definido.")}

Brand Kit: ${brandInfo}

Formato do criativo: ${selectedFormat}

Gere um criativo completo com:
1. **Título**: frase de impacto curta
2. **Copy persuasiva**: entre 2 a 4 linhas (máx 300 caracteres), focada em conversão
3. **Proposta de imagem**: sugestão visual que complemente a copy e funcione no formato ${selectedFormat}
4. **Objetivo estratégico**: (ex: gerar cliques, despertar curiosidade, estimular ação imediata)
${customPrompt ? `\nInstruções adicionais do usuário:\n${customPrompt}\n` : ""}
Seja criativo, preciso e comercialmente estratégico. Foque sempre em conversão.
Retorne em formato JSON com as chaves: titulo, copy, proposta_imagem, objetivo_estrategico`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_briefing",
              description: "Create a creative briefing",
              parameters: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  copy: { type: "string" },
                  proposta_imagem: { type: "string" },
                  objetivo_estrategico: { type: "string" },
                },
                required: ["titulo", "copy", "proposta_imagem", "objetivo_estrategico"],
              },
            },
          }],
          toolChoice: { type: "function", function: { name: "create_briefing" } },
        });

        if (!briefingResult.ok) {
          console.error("Briefing error:", briefingResult.status, briefingResult.errorBody);
          if (briefingResult.status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
          if (briefingResult.status === 402) throw new Error("Créditos insuficientes na OpenRouter.");
          continue;
        }

        const briefing: any = parseToolCall(briefingResult.data);
        if (!briefing) {
          console.error("Failed to parse briefing");
          continue;
        }

        // Step 2: Generate image
        const imagePrompt = `Create a professional ad creative image for social media.

OUTPUT FORMAT: ${selectedFormat} aspect ratio. Compose the layout specifically for this format.

HEADLINE TEXT (must appear prominently in the image): "${briefing.titulo || ""}"
${briefing.copy ? `SUPPORTING COPY (include as secondary text in the layout): "${briefing.copy}"` : ""}

Visual concept: ${briefing.proposta_imagem || "professional marketing image"}
Brand colors: primary ${(useBrandKit && brandKit.primary_color) || "#333"}, secondary ${(useBrandKit && brandKit.secondary_color) || "#666"}${useBrandKit && brandKit.background_color ? `, background ${brandKit.background_color}` : ""}
Typography: ${(useBrandKit && brandKit.typography) || "modern sans-serif"}
Style: Clean, professional, high-conversion ad creative with clear text hierarchy.
IMPORTANT: The headline and copy text MUST be rendered as readable text elements in the image, integrated into the visual layout like a real advertisement. Use the brand typography and colors for the text.
${logoUrl ? "\nLOGO: The brand logo is attached. Place it COMPLETE (never cropped, redrawn or recolored), small and discreet (about 3-5% of the image area), in a corner with a safe margin. Nothing may overlap it." : ""}`;

        const userContent: any[] = [{ type: "text", text: imagePrompt }];
        if (logoUrl) {
          userContent.push(
            { type: "text", text: "📎 LOGO DA MARCA (asset obrigatório):" },
            { type: "image_url", image_url: { url: logoUrl } },
          );
        }

        const image = await generateImageWithCascade({
          messages: [{ role: "user", content: userContent }],
          aspectRatio: selectedFormat,
          track,
          startedAt: START_TS,
          budgetMs: TIME_BUDGET_MS + 10000,
        });

        if (!image.ok || !image.image) {
          lastFailure = imageFailurePayload(image);
          if (image.stopReason === "credits") break outer;
          results.push({ type, briefing, imageUrl: "", error: lastFailure.body.error });
          continue;
        }

        const bytes = await imageToBytes(image.image);
        const imageUrl = await uploadGeneratedImage(db, "generated-creatives", projectId, bytes, "dynamic-");

        const inserted = await insertCreative(db, {
          project_id: projectId,
          created_by: userId,
          prompt: `[${type}] ${briefing.titulo || ""}`,
          format: selectedFormat,
          image_url: imageUrl,
          kind: "dynamic",
          briefing: { type, ...briefing },
          model_used: image.model,
          cost_usd: image.costUsd + (briefingResult.costUsd || 0),
          generation_meta: {
            mode: "dynamic",
            format: selectedFormat,
            hasLogo: !!logoUrl,
            ignoreBrandKit: !!ignoreBrandKit,
            ignoreContext: !!ignoreContext,
          },
        }).catch((insertError) => {
          console.error("Insert error:", insertError);
          return { id: null };
        });

        results.push({ type, briefing, imageUrl, creativeId: inserted.id });
      }
    }

    // Nothing produced at all → surface the provider error with its status code.
    if (!results.some((r) => r.imageUrl) && lastFailure) {
      return jsonResponse(lastFailure.body, lastFailure.status, lastFailure.headers);
    }

    return jsonResponse({ success: true, results, truncated });
  } catch (e) {
    console.error("generate-dynamic-creative error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("Rate limit") ? 429 : msg.includes("Créditos") ? 402 : 400;
    return jsonResponse({ error: msg || "Erro ao gerar criativos" }, status);
  }
});
