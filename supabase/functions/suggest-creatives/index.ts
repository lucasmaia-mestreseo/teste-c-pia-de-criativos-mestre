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
    const { requireProjectAccess } = await import("../_shared/auth.ts");
    const { projectId } = await req.json();
    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("name, context, voice_guide")
      .eq("id", projectId)
      .single();

    if (projErr || !project) throw new Error("Project not found");

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

    const result = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
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
      toolChoice: { type: "function", function: { name: "suggest_creatives" } },
    });

    if (!result.ok) {
      if (result.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", result.status, result.errorBody);
      throw new Error("AI gateway error");
    }

    const toolCall = result.data?.choices?.[0]?.message?.tool_calls?.[0];
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
