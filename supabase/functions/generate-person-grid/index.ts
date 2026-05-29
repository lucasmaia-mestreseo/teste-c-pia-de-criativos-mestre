import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildModelCascade, callOpenRouter, extractImageUrl, loadImageGenSettings } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Strip non-essential PNG chunks (metadata, EXIF, text) keeping only image data */
function stripPngMetadata(data: Uint8Array): Uint8Array {
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIG[i]) return data;
  }
  const keepTypes = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  const chunks: Uint8Array[] = [data.slice(0, 8)];
  let offset = 8;
  while (offset < data.length) {
    const len = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
    const type = String.fromCharCode(data[offset+4], data[offset+5], data[offset+6], data[offset+7]);
    const chunkSize = 12 + len;
    if (keepTypes.has(type)) {
      chunks.push(data.slice(offset, offset + chunkSize));
    }
    offset += chunkSize;
    if (type === "IEND") break;
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photos, projectId } = await req.json();

    if (!photos || photos.length === 0) {
      throw new Error("Nenhuma foto de pessoa fornecida");
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

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

    const imageSettings = await loadModelSettings("image_generation");
    const cascade = buildModelCascade(imageSettings);
    let generatedImage: string | undefined;
    let lastStatus = 0;
    let lastErr: string | null = null;

    for (const { model } of cascade) {
      const r = await callOpenRouter({
        model,
        messages: [
          { role: "system", content: "You are an expert cinematographer and character consistency specialist. Generate photorealistic multi-angle grids maintaining absolute character fidelity." },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      });
      lastStatus = r.status;
      if (!r.ok) {
        lastErr = r.errorBody ?? null;
        console.error(`person-grid OpenRouter error (${model}):`, r.status, lastErr);
        if (r.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes na OpenRouter." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (r.status === 429) {
          const ra = r.retryAfter ? parseInt(r.retryAfter, 10) : NaN;
          await new Promise(res => setTimeout(res, !Number.isNaN(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 1500));
        }
        continue;
      }
      generatedImage = extractImageUrl(r.data);
      if (generatedImage) break;
    }

    if (!generatedImage) {
      if (lastStatus === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Nenhuma imagem foi gerada pela IA: " + (lastErr || "sem detalhes"));
    }

    // Upload to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const rawBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const imageBytes = stripPngMetadata(rawBytes);
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
