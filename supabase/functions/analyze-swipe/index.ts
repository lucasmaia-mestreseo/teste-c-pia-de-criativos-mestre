import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenRouterWithCascade } from "../_shared/openrouter.ts";

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
    const { swipeFileUrl, swipeFileId } = await req.json();
    if (!swipeFileUrl || !swipeFileId) {
      throw new Error("swipeFileUrl and swipeFileId are required");
    }

    const result = await callOpenRouterWithCascade({
      settingsKey: "vision_analysis",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this advertising creative image. Identify ALL visual elements and return structured data using the provided tool.

For each TEXT element found:
- Extract the EXACT text content (every character as written)
- Identify its position (e.g. "topo-centro", "centro", "inferior-esquerdo", "inferior-centro", "inferior-direito", "topo-esquerdo", "topo-direito")
- Classify its role: "headline" (main title), "subtitle" (secondary text), "cta" (call-to-action button text), "caption" (small descriptive text), "body" (body text), "other"

For each LOGO found:
- Describe it briefly
- Identify its position

For each PHOTO/PERSON found:
- Describe it briefly (what the person looks like, what they're doing)
- Identify its position

Be thorough — capture EVERY text block, even small ones. Answer in Portuguese.`,
            },
            { type: "image_url", image_url: { url: swipeFileUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_analysis",
            description: "Report all detected elements in the creative image",
            parameters: {
              type: "object",
              properties: {
                texts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Unique ID like text_1, text_2" },
                      content: { type: "string", description: "Exact text content" },
                      position: { type: "string", description: "Position in the image" },
                      role: { type: "string", enum: ["headline", "subtitle", "cta", "caption", "body", "other"] },
                    },
                    required: ["id", "content", "position", "role"],
                    additionalProperties: false,
                  },
                },
                logos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Unique ID like logo_1" },
                      position: { type: "string", description: "Position in the image" },
                      description: { type: "string", description: "Brief description of the logo" },
                    },
                    required: ["id", "position", "description"],
                    additionalProperties: false,
                  },
                },
                photos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Unique ID like photo_1" },
                      position: { type: "string", description: "Position in the image" },
                      description: { type: "string", description: "Brief description of person/photo" },
                    },
                    required: ["id", "position", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["texts", "logos", "photos"],
              additionalProperties: false,
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "report_analysis" } },
    });

    if (!result.ok) {
      if (result.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", result.status, result.errorBody);
      throw new Error("Erro na análise da imagem");
    }

    const toolCall = result.data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned from AI");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from("swipe_files")
      .update({ analysis })
      .eq("id", swipeFileId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-swipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
