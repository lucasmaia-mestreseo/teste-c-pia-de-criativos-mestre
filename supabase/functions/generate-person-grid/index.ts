import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { photos, projectId } = await req.json();

    if (!photos || photos.length === 0) {
      throw new Error("Nenhuma foto de pessoa fornecida");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use the first photo as the primary reference
    const primaryPhoto = photos[0];

    const gridPrompt = `Using the provided input image as the absolute ground truth for the character and style, generate a photorealistic 3x3 grid collage in 16:9 aspect ratio.

INSTRUCTIONS:
1. Analyze the input image for subject identity, lighting, skin texture, emotion, and color palette.
2. If the input is a close-up, logically infer the subject's outfit, body type, and environment based on the style of the face. Maintain strictly consistent character design across all 9 panels.
3. Generate a 3x3 grid where each panel corresponds to the specific camera definitions below.

CAMERA ANGLE SPECIFICATIONS:
- MCU (Macro Close Up): Focus intensely on facial details, eyes, or textures. Crop top of head and chin.
- MS (Medium Shot): Waist or chest up. Standard cinematic portrait framing.
- OS (Over the Shoulder): Camera placed behind a vague foreground element/shoulder, looking at the subject.
- WS (Wide Shot): Full body shot. Show the subject's posture, outfit, and relationship with the environment.
- HA (High Angle): Camera is physically higher than the subject, looking down. Emphasize vulnerability or diminishing size.
- LA (Low Angle): Camera is physically lower than the subject, looking up. Emphasize dominance or stature.
- P (Profile): Strictly from the side (90 degrees). Subject looks completely left or right.
- ThreeQ (3/4 View): Subject turned 45 degrees away from the camera. Classic portrait angle.
- B (Back View): Camera is directly behind the subject. Seeing the back of the head/body.

OUTPUT FORMAT:
- Grid layout: 3x3
- Aspect ratio: 16:9
- Must include white text abbreviations (MCU, MS, OS, WS, HA, LA, P, 3/4, B) in the top-left corner of each panel.

Grid Order:
Row 1: MCU, MS, OS
Row 2: WS, HA, LA
Row 3: P, 3/4, B

CRITICAL: The lighting and color grading must remain identical to the input source in every single angle. The person must be IDENTICAL across all 9 panels — same face, same features, same skin tone, same hair.`;

    // Build content with all provided photos
    const userContent: any[] = [
      { type: "text", text: gridPrompt },
      {
        type: "image_url",
        image_url: { url: primaryPhoto },
      },
    ];

    // Add additional photos as extra references
    for (let i = 1; i < Math.min(photos.length, 4); i++) {
      userContent.push(
        { type: "text", text: `📎 Additional reference photo ${i + 1} of the same person:` },
        { type: "image_url", image_url: { url: photos[i] } },
      );
    }

    console.log("Generating person grid with", photos.length, "reference photos...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert cinematographer and character consistency specialist. Generate photorealistic multi-angle grids maintaining absolute character fidelity.",
          },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Erro na geração do grid");
    }

    const aiData = await aiResponse.json();
    const generatedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("Nenhuma imagem foi gerada pela IA");
    }

    // Upload to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `${projectId}/grid-${crypto.randomUUID()}.png`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: uploadError } = await supabase.storage
      .from("people-photos")
      .upload(filePath, imageBytes, { contentType: "image/png" });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("people-photos")
      .getPublicUrl(filePath);

    console.log("Grid generated and uploaded:", publicUrl);

    return new Response(JSON.stringify({ success: true, gridUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-person-grid error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
