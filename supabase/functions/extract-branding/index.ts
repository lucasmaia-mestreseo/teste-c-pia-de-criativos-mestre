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
    const { url, image } = await req.json();
    if (!url && !image) throw new Error("URL ou screenshot é obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [];

    if (image) {
      userContent.push({
        type: "image_url",
        image_url: { url: image.startsWith("data:") ? image : `data:image/png;base64,${image}` },
      });
      userContent.push({
        type: "text",
        text: "Analyze this screenshot and extract the branding: primary color, secondary color, background color, auxiliary colors (hex codes), and typography/font families.",
      });
    } else {
      userContent.push({
        type: "text",
        text: `Analyze the branding of this website: ${url}\n\nExtract the primary color, secondary color, background color, auxiliary colors (as hex codes), and typography/font families used.`,
      });
    }

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
            content: `You are a brand identity analyst. Analyze websites or screenshots and extract branding elements. Return structured data using the provided tool. Always return hex color codes starting with #.`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_branding",
              description: "Extract categorized branding elements",
              parameters: {
                type: "object",
                properties: {
                  primary_color: {
                    type: "string",
                    description: "Primary brand color as hex (e.g. #FF5500)",
                  },
                  secondary_color: {
                    type: "string",
                    description: "Secondary brand color as hex",
                  },
                  background_color: {
                    type: "string",
                    description: "Main background color as hex",
                  },
                  aux_colors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Other auxiliary/accent colors as hex codes. Max 5.",
                  },
                  typography: {
                    type: "string",
                    description: "Main font families used (e.g. 'Inter, Montserrat')",
                  },
                },
                required: ["primary_color", "secondary_color", "background_color", "aux_colors", "typography"],
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
      throw new Error("Erro ao analisar");
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
