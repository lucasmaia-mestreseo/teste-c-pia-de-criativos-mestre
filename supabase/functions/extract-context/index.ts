import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import { callOpenRouterWithCascade } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { firecrawlScrape, normalizeUrl, perplexitySearch } from "../_shared/connectors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!Deno.env.get("FIRECRAWL_API_KEY")) throw new Error("Firecrawl não configurado");

    const { url, projectId } = await req.json();
    if (!url || !projectId) throw new Error("URL e projectId são obrigatórios");

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const track = { functionName: "extract-context", projectId, userId: authed.userId };

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const formattedUrl = normalizeUrl(url);
    console.log("Extracting context from URL:", formattedUrl);

    // 1. Firecrawl: get markdown content
    const fcData = await firecrawlScrape({
      url: formattedUrl,
      formats: ["markdown"],
      onlyMainContent: true,
    });
    const siteContent: string = fcData?.markdown || "";

    // 2. Perplexity Search: research the company (optional — skipped if not configured)
    const domain = new URL(formattedUrl).hostname.replace("www.", "");
    const results = Deno.env.get("PERPLEXITY_API_KEY")
      ? await perplexitySearch(`empresa ${domain}: produtos, serviços, público-alvo, posicionamento de mercado, diferenciais competitivos`)
      : [];
    const research = results.map((r) => `- ${r.title}: ${r.snippet} (${r.url})`).join("\n");

    // 3. Fetch prompts
    const { data: prompts } = await anonClient
      .from("template_prompts")
      .select("id, prompt")
      .in("id", ["context-extraction", "voice-analysis"]);

    const contextPrompt = prompts?.find((p: any) => p.id === "context-extraction")?.prompt || "";
    const voicePrompt = prompts?.find((p: any) => p.id === "voice-analysis")?.prompt || "";

    // 4. Context and voice guide are independent — run them in parallel.
    const [contextResult, voiceResult] = await Promise.all([
      callOpenRouterWithCascade({
        settingsKey: "text_reasoning",
        track,
        messages: [
          { role: "system", content: contextPrompt },
          { role: "user", content: `## Conteúdo do site (${formattedUrl}):\n\n${siteContent.substring(0, 8000)}\n\n## Pesquisa sobre a empresa:\n\n${research.substring(0, 4000) || "Sem pesquisa externa disponível."}` },
        ],
      }),
      callOpenRouterWithCascade({
        settingsKey: "text_reasoning",
        track,
        messages: [
          { role: "system", content: voicePrompt },
          { role: "user", content: `Analise o tom de voz do seguinte conteúdo do site ${formattedUrl}:\n\n${siteContent.substring(0, 8000)}` },
        ],
      }),
    ]);

    if (!contextResult.ok) {
      console.error("AI context error:", contextResult.status, contextResult.errorBody);
      throw new Error(`Erro ao gerar contexto com IA (${contextResult.status})`);
    }
    if (!voiceResult.ok) {
      console.error("AI voice error:", voiceResult.status, voiceResult.errorBody);
      throw new Error(`Erro ao gerar guia de voz com IA (${voiceResult.status})`);
    }

    return jsonResponse({
      success: true,
      context: contextResult.data?.choices?.[0]?.message?.content || "",
      voiceGuide: voiceResult.data?.choices?.[0]?.message?.content || "",
    });
  } catch (e) {
    console.error("extract-context error:", e);
    const msg = (e as Error).message || "Erro ao extrair contexto";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 400;
    return jsonResponse({ error: msg }, status);
  }
});
