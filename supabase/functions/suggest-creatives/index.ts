import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callOpenRouterWithCascade } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("name, context, voice_guide")
      .eq("id", projectId)
      .single();

    if (projErr || !project) throw new Error("Project not found");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const systemPrompt = `Você é um diretor criativo especialista em anúncios para redes sociais.
Gere exatamente 3 sugestões de criativos para o projeto fornecido:
1. CONSERVADOR: Linguagem direta, provas sociais, benefícios concretos. Seguro e eficaz.
2. INOVADOR: Abordagem nova, metáforas visuais, storytelling incomum. Surpreende sem assustar.
3. FORA DA CAIXA: Disruptivo, viral, provocativo, não convencional. Gera buzz e engajamento.

Cada sugestão deve ser um briefing completo para gerar um criativo visual, com título chamativo, copy persuasiva, proposta visual detalhada e objetivo estratégico.
O tom de voz e o contexto do projeto devem guiar todas as sugestões.`;

    const userPrompt = `## Projeto: ${project.name}

## Contexto:
${project.context || "Sem contexto definido."}

## Tom de Voz:
${project.voice_guide || "Sem guia de voz definido."}

Gere as 3 sugestões de criativos.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_creatives",
              description: "Return 3 creative suggestions: conservative, innovative, out-of-the-box.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["conservative", "innovative", "radical"], description: "The type of creative" },
                        titulo: { type: "string", description: "Catchy title for the creative" },
                        copy: { type: "string", description: "Persuasive copy text" },
                        proposta_imagem: { type: "string", description: "Detailed visual proposal" },
                        objetivo_estrategico: { type: "string", description: "Strategic objective" },
                      },
                      required: ["type", "titulo", "copy", "proposta_imagem", "objetivo_estrategico"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_creatives" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-creatives error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
