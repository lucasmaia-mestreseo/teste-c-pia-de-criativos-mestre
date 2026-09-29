import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/storage.ts";
import { firecrawlScrape, normalizeUrl, screenshotToBytes } from "../_shared/connectors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    if (!req.headers.get("Authorization")) throw new Error("Não autenticado");
    if (!Deno.env.get("FIRECRAWL_API_KEY")) throw new Error("Firecrawl não configurado");

    const { url, projectId } = await req.json();
    if (!url || !projectId) throw new Error("URL e projectId são obrigatórios");

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const formattedUrl = normalizeUrl(url);
    console.log("Scraping URL for design system:", formattedUrl);

    const fcData = await firecrawlScrape({
      url: formattedUrl,
      formats: ["screenshot", "branding"],
      waitFor: 3000,
    });

    const screenshot: string | undefined = fcData?.screenshot;
    const branding = fcData?.branding;

    // Upload screenshot to storage
    let screenshotUrl = "";
    if (screenshot) {
      const adminDb = adminClient();
      const bytes = await screenshotToBytes(screenshot);
      const path = `${projectId}/design-screenshot-${Date.now()}.png`;

      const { error: uploadErr } = await adminDb.storage
        .from("brand-photos")
        .upload(path, bytes, { contentType: "image/png", upsert: true });

      if (uploadErr) console.error("Upload error:", uploadErr);
      else screenshotUrl = adminDb.storage.from("brand-photos").getPublicUrl(path).data.publicUrl;
    }

    // Extract design system data from branding
    let designData: Record<string, unknown> = {};
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

    return jsonResponse({ success: true, screenshotUrl, ...designData });
  } catch (e) {
    console.error("extract-design-system error:", e);
    return jsonResponse({ error: (e as Error).message || "Erro ao extrair design system" }, 400);
  }
});
