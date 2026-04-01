import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey) throw new Error("Firecrawl não configurado");
    if (!lovableKey) throw new Error("Lovable AI não configurado");

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { url, projectId } = await req.json();
    if (!url || !projectId) throw new Error("URL e projectId são obrigatórios");

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

    console.log("Scraping URL for design system:", formattedUrl);

    // Firecrawl: get screenshot + branding
    const fcResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["screenshot", "branding"],
        waitFor: 3000,
      }),
    });

    const fcData = await fcResponse.json();
    if (!fcResponse.ok) throw new Error(fcData.error || "Erro no Firecrawl");

    const screenshot = fcData.data?.screenshot || fcData.screenshot;
    const branding = fcData.data?.branding || fcData.branding;

    // Upload screenshot to storage
    let screenshotUrl = "";
    if (screenshot) {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Convert base64 to bytes
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const path = `${projectId}/design-screenshot-${Date.now()}.png`;

      const { error: uploadErr } = await adminClient.storage
        .from("brand-photos")
        .upload(path, bytes, { contentType: "image/png", upsert: true });

      if (uploadErr) console.error("Upload error:", uploadErr);
      else {
        const { data: { publicUrl } } = adminClient.storage.from("brand-photos").getPublicUrl(path);
        screenshotUrl = publicUrl;
      }
    }

    // Extract design system data from branding
    let designData: any = {};
    if (branding) {
      designData = {
        primary_color: branding.colors?.primary || null,
        secondary_color: branding.colors?.secondary || null,
        background_color: branding.colors?.background || null,
        aux_colors: [
          branding.colors?.accent,
          branding.colors?.textPrimary,
          branding.colors?.textSecondary,
        ].filter(Boolean),
        typography: branding.typography?.fontFamilies?.primary || branding.fonts?.[0]?.family || null,
      };
    }

    return new Response(JSON.stringify({
      success: true,
      screenshotUrl,
      ...designData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-design-system error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao extrair design system" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
