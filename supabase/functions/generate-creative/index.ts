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
    const { prompt, format, swipeFileId, swipeFileUrl, projectId, brandKit } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build rich brand context
    let brandContext = "";
    if (brandKit) {
      const parts: string[] = [];
      if (brandKit.primaryColor) parts.push(`Cor primária da marca: ${brandKit.primaryColor}`);
      if (brandKit.secondaryColor) parts.push(`Cor secundária da marca: ${brandKit.secondaryColor}`);
      if (brandKit.backgroundColor) parts.push(`Cor de fundo da marca: ${brandKit.backgroundColor}`);
      if (brandKit.auxColors?.length) parts.push(`Cores auxiliares: ${brandKit.auxColors.join(", ")}`);
      if (brandKit.typography) parts.push(`Tipografia/fonte: ${brandKit.typography}`);
      if (parts.length) brandContext = `\n\nDiretrizes de marca a seguir rigorosamente:\n${parts.join("\n")}`;
    }

    const systemPrompt = `You are an expert advertising creative designer. You will receive a reference creative image and must generate a new creative based on it, following the user's instructions. The output format should be ${format} (aspect ratio). Maintain the visual structure and layout style of the reference but apply the requested modifications.${brandContext}`;

    // Build dynamic content array
    const userContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: swipeFileUrl } },
    ];

    if (brandKit?.logoUrl) {
      userContent.push(
        { type: "text", text: "A imagem a seguir é o logo oficial da marca. Incorpore-o no criativo de forma visível e harmoniosa:" },
        { type: "image_url", image_url: { url: brandKit.logoUrl } },
      );
    }

    if (brandKit?.personPhotoUrl) {
      userContent.push(
        { type: "text", text: "A imagem a seguir é uma foto de pessoa da marca. Inclua esta pessoa no criativo, mantendo fidelidade ao rosto e aparência:" },
        { type: "image_url", image_url: { url: brandKit.personPhotoUrl } },
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Erro na geração de imagem");
    }

    const aiData = await aiResponse.json();
    const generatedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("Nenhuma imagem foi gerada pela IA");
    }

    // Extract base64 data and upload to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `${projectId}/${crypto.randomUUID()}.png`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: uploadError } = await supabase.storage
      .from("generated-creatives")
      .upload(filePath, imageBytes, { contentType: "image/png" });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("generated-creatives")
      .getPublicUrl(filePath);

    // Save to database
    const { error: dbError } = await supabase.from("generated_creatives").insert({
      project_id: projectId,
      swipe_file_id: swipeFileId,
      image_url: publicUrl,
      prompt,
      format,
    });
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, imageUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
