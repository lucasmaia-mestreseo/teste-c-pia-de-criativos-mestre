// Firecrawl / Perplexity access for Edge Functions.
//
// Inside Lovable Cloud the keys come from Lovable "connectors" and must be sent
// through the Lovable connector gateway (LOVABLE_API_KEY + X-Connection-Api-Key).
// Outside Lovable (or with a regular API key) we call the provider directly.
// We try the gateway first when it is available and fall back to the direct API.

const GATEWAY = "https://connector-gateway.lovable.dev";

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function viaGatewayOrDirect(
  providerKey: string | undefined,
  gatewayPath: string,
  directUrl: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  if (!providerKey) return { ok: false, status: 0, data: { error: "chave não configurada" } };
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    const r = await postJson(`${GATEWAY}${gatewayPath}`, {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": providerKey,
    }, body);
    if (r.ok) return r;
    console.warn(`Connector gateway ${gatewayPath} failed (${r.status}); trying direct API`);
  }
  return postJson(directUrl, { Authorization: `Bearer ${providerKey}` }, body);
}

/** Firecrawl v2 scrape. Returns the `data` object ({ markdown, screenshot, branding, ... }). */
export async function firecrawlScrape(body: Record<string, unknown>): Promise<any> {
  const r = await viaGatewayOrDirect(
    Deno.env.get("FIRECRAWL_API_KEY"),
    "/firecrawl/v2/scrape",
    "https://api.firecrawl.dev/v2/scrape",
    body,
  );
  if (!r.ok) throw new Error(r.data?.error || `Erro no Firecrawl (${r.status})`);
  return r.data?.data ?? r.data;
}

/** Perplexity Search. Returns the list of results (empty on failure — research is optional). */
export async function perplexitySearch(query: string, maxResults = 8): Promise<Array<{ title: string; snippet: string; url: string }>> {
  const r = await viaGatewayOrDirect(
    Deno.env.get("PERPLEXITY_API_KEY"),
    "/perplexity/search",
    "https://api.perplexity.ai/search",
    { query, max_results: maxResults },
  );
  if (!r.ok) {
    console.warn("Perplexity search failed:", r.status, JSON.stringify(r.data).slice(0, 300));
    return [];
  }
  return r.data?.results || [];
}

/** Firecrawl screenshots come back as a URL or base64; normalize to bytes. */
export async function screenshotToBytes(screenshot: string): Promise<Uint8Array> {
  if (screenshot.startsWith("http")) {
    const res = await fetch(screenshot);
    if (!res.ok) throw new Error(`Failed to fetch screenshot: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const base64 = screenshot.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function normalizeUrl(url: string): string {
  const u = url.trim();
  return u.startsWith("http") ? u : `https://${u}`;
}
