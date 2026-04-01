import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) throw new Error("Lovable AI não configurado");

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { projectId, types, format, ignoreBrandKit, ignoreContext } = await req.json();
    // types: Array<{ type: 'conservative' | 'innovative' | 'radical', count: number }>
    if (!projectId || !types?.length) throw new Error("projectId e types são obrigatórios");
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
    const { data: prompts } = await anonClient.from("template_prompts").select("id, prompt").in("id", promptIds);
    const promptMap = new Map((prompts || []).map((p: any) => [p.id, p.prompt]));

    const brandInfo = brandKit
      ? `Cores: primária ${brandKit.primary_color || "N/A"}, secundária ${brandKit.secondary_color || "N/A"}, fundo ${brandKit.background_color || "N/A"}. Tipografia: ${brandKit.typography || "N/A"}.`
      : "Sem brand kit definido.";

    const results: any[] = [];
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    for (const { type, count } of types) {
      const basePrompt = promptMap.get(typeToPromptId[type]) || "";
      const validCount = Math.min(Math.max(1, count), 5);

      for (let i = 0; i < validCount; i++) {
        // Step 1: Generate briefing
        const briefingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: basePrompt },
              {
                role: "user",
                content: `Contexto do projeto "${project?.name || ""}":
${project?.context || "Sem contexto definido."}

Tom de voz: ${project?.voice_guide || "Não definido."}

Brand Kit: ${brandInfo}

Gere um criativo completo com:
1. **Título**: frase de impacto curta
2. **Copy persuasiva**: entre 2 a 4 linhas (máx 300 caracteres), focada em conversão
3. **Proposta de imagem**: sugestão visual que complemente a copy
4. **Objetivo estratégico**: (ex: gerar cliques, despertar curiosidade, estimular ação imediata)

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
            tool_choice: { type: "function", function: { name: "create_briefing" } },
          }),
        });

        if (!briefingResponse.ok) {
          const errText = await briefingResponse.text();
          console.error("Briefing error:", briefingResponse.status, errText);
          if (briefingResponse.status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
          if (briefingResponse.status === 402) throw new Error("Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage.");
          continue;
        }

        const briefingData = await briefingResponse.json();
        let briefing: any = {};
        try {
          const toolCall = briefingData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            briefing = JSON.parse(toolCall.function.arguments);
          } else {
            const content = briefingData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) briefing = JSON.parse(jsonMatch[0]);
          }
        } catch {
          console.error("Failed to parse briefing");
          continue;
        }

        // Step 2: Generate image
        const imagePrompt = `Create a professional ad creative image for social media.
Title: "${briefing.titulo || ""}"
Visual concept: ${briefing.proposta_imagem || "professional marketing image"}
Brand colors: primary ${brandKit?.primary_color || "#333"}, secondary ${brandKit?.secondary_color || "#666"}
Typography: ${brandKit?.typography || "modern sans-serif"}
Style: Clean, professional, high-conversion ad creative.
DO NOT include any text in the image. The image should be purely visual.`;

        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!imageResponse.ok) {
          console.error("Image gen error:", imageResponse.status);
          if (imageResponse.status === 429) throw new Error("Rate limit excedido. Tente novamente em alguns minutos.");
          if (imageResponse.status === 402) throw new Error("Créditos insuficientes.");
          continue;
        }

        const imageData = await imageResponse.json();
        const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        let imageUrl = "";
        if (imageBase64) {
          const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          const bytes = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));
          const path = `${projectId}/dynamic-${Date.now()}-${i}.png`;

          const { error: upErr } = await adminClient.storage
            .from("generated-creatives")
            .upload(path, bytes, { contentType: "image/png" });

          if (!upErr) {
            const { data: { publicUrl } } = adminClient.storage.from("generated-creatives").getPublicUrl(path);
            imageUrl = publicUrl;
          }
        }

        // Save to DB
        if (imageUrl) {
          await adminClient.from("generated_creatives").insert({
            project_id: projectId,
            created_by: user.id,
            prompt: `[${type}] ${briefing.titulo || ""}`,
            format: selectedFormat,
            image_url: imageUrl,
          });
        }

        results.push({
          type,
          briefing,
          imageUrl,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-dynamic-creative error:", e);
    const status = e.message?.includes("429") ? 429 : e.message?.includes("402") ? 402 : 400;
    return new Response(JSON.stringify({ error: e.message || "Erro ao gerar criativos" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
