import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenRouterWithCascade } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { context, texts } = await req.json();
    if (!context || !texts?.length) {
      return new Response(JSON.stringify({ error: "context and texts are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textsDescription = texts.map((t: any) =>
      `- ID: "${t.id}", Role: "${t.role}", Position: "${t.position}", Current text: "${t.content}"`
    ).join("\n");

    const systemPrompt = `Você é um copywriter especialista em criativos para redes sociais. 
O usuário fornecerá o contexto do projeto e uma lista de elementos de texto detectados em um criativo.
Sua tarefa é sugerir textos substitutos que façam sentido para o projeto, mantendo o mesmo papel (headline, CTA, subtítulo, etc.) e tamanho aproximado do texto original.
Seja criativo, persuasivo e direto. Use o tom de voz descrito no contexto.`;

    const userPrompt = `## Contexto do Projeto:
${context}

## Elementos de texto no criativo:
${textsDescription}

Sugira um texto substituto para CADA elemento, respeitando seu papel e tamanho aproximado.`;

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
            name: "suggest_texts",
            description: "Return suggested replacement texts for each detected element.",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "The element ID" },
                      text: { type: "string", description: "Suggested replacement text" },
                    },
                    required: ["id", "text"],
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
      toolChoice: { type: "function", function: { name: "suggest_texts" } },
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
    console.error("suggest-texts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
