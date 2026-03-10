import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) throw new Error("URL é obrigatória");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a brand identity analyst. Given a website URL, analyze the website and extract its branding elements. Return structured data using the provided tool.`,
          },
          {
            role: "user",
            content: `Analyze the branding of this website: ${url}\n\nExtract the primary colors (as hex codes), typography/font families used, and a brief description of the visual style.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_branding",
              description: "Extract branding elements from a website",
              parameters: {
                type: "object",
                properties: {
                  colors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Brand colors as hex codes (e.g. #FF5500). Include primary, secondary, accent colors. Max 6.",
                  },
                  typography: {
                    type: "string",
                    description: "Main font families used (e.g. 'Inter, Montserrat')",
                  },
                  style_description: {
                    type: "string",
                    description: "Brief description of the visual style (e.g. 'Modern minimalist with bold accents')",
                  },
                },
                required: ["colors", "typography", "style_description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_branding" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro ao analisar site");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados");
    }

    const branding = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(branding), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-branding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
