import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateImageWithCascade, imageFailurePayload } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, imageToBytes, uploadGeneratedImage } from "../_shared/storage.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const START_TS = Date.now();

  try {
    const { photos, projectId } = await req.json();

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    if (!photos || photos.length === 0) {
      throw new Error("Nenhuma foto de pessoa fornecida");
    }
    if (!Deno.env.get("OPENROUTER_API_KEY")) throw new Error("OPENROUTER_API_KEY not configured");

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
      { type: "image_url", image_url: { url: primaryPhoto } },
    ];

    // Add additional photos as extra references
    for (let i = 1; i < Math.min(photos.length, 4); i++) {
      userContent.push(
        { type: "text", text: `📎 Additional reference photo ${i + 1} of the same person:` },
        { type: "image_url", image_url: { url: photos[i] } },
      );
    }

    console.log("Generating person grid with", photos.length, "reference photos...");

    const result = await generateImageWithCascade({
      messages: [
        { role: "system", content: "You are an expert cinematographer and character consistency specialist. Generate photorealistic multi-angle grids maintaining absolute character fidelity." },
        { role: "user", content: userContent },
      ],
      aspectRatio: "16:9",
      track: { functionName: "generate-person-grid", projectId, userId: authed.userId },
      startedAt: START_TS,
    });

    if (!result.ok || !result.image) {
      const failure = imageFailurePayload(result);
      return jsonResponse(failure.body, failure.status, failure.headers);
    }

    const bytes = await imageToBytes(result.image);
    const gridUrl = await uploadGeneratedImage(adminClient(), "people-photos", projectId, bytes, "grid-");
    console.log("Grid generated and uploaded:", gridUrl);

    return jsonResponse({ success: true, gridUrl });
  } catch (e) {
    console.error("generate-person-grid error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
