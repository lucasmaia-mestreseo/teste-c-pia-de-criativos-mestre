import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import { callOpenRouterWithCascade } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";

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
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey) throw new Error("Firecrawl não configurado");
    if (!perplexityKey) throw new Error("Perplexity não configurado");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { url, projectId } = await req.json();
    if (!url || !projectId) throw new Error("URL e projectId são obrigatórios");

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

    console.log("Extracting context from URL:", formattedUrl);

    // 1. Firecrawl (via Lovable connector gateway): get markdown content
    const fcResponse = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    const fcData = await fcResponse.json();
    if (!fcResponse.ok) throw new Error(fcData.error || "Erro no Firecrawl");
    const siteContent = fcData.data?.markdown || fcData.markdown || "";

    // 2. Perplexity Search (via Lovable connector gateway): research the company
    const domain = new URL(formattedUrl).hostname.replace("www.", "");
    const pxResponse = await fetch("https://connector-gateway.lovable.dev/perplexity/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": perplexityKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `empresa ${domain}: produtos, serviços, público-alvo, posicionamento de mercado, diferenciais competitivos`,
        max_results: 8,
      }),
    });
    const pxData = await pxResponse.json();
    if (!pxResponse.ok) {
      console.warn("Perplexity search failed:", pxResponse.status, JSON.stringify(pxData).slice(0, 300));
    }
    const research = (pxData.results || [])
      .map((r: any) => `- ${r.title}: ${r.snippet} (${r.url})`)
      .join("\n");

    // 3. Fetch prompts
    const { data: prompts } = await anonClient
      .from("template_prompts")
      .select("id, prompt")
      .in("id", ["context-extraction", "voice-analysis"]);

    const contextPrompt = prompts?.find((p: any) => p.id === "context-extraction")?.prompt || "";
    const voicePrompt = prompts?.find((p: any) => p.id === "voice-analysis")?.prompt || "";

    const contextResult = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
      messages: [
        { role: "system", content: contextPrompt },
        { role: "user", content: `## Conteúdo do site (${formattedUrl}):\n\n${siteContent.substring(0, 8000)}\n\n## Pesquisa sobre a empresa:\n\n${research.substring(0, 4000)}` },
      ],
    });

    if (!contextResult.ok) {
      console.error("AI context error:", contextResult.status, contextResult.errorBody);
      throw new Error("Erro ao gerar contexto com IA");
    }

    const generatedContext = contextResult.data?.choices?.[0]?.message?.content || "";

    // 5. Generate voice guide via OpenRouter
    const voiceResult = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
      messages: [
        { role: "system", content: voicePrompt },
        { role: "user", content: `Analise o tom de voz do seguinte conteúdo do site ${formattedUrl}:\n\n${siteContent.substring(0, 8000)}` },
      ],
    });

    if (!voiceResult.ok) {
      console.error("AI voice error:", voiceResult.status, voiceResult.errorBody);
      throw new Error("Erro ao gerar guia de voz com IA");
    }

    const voiceGuide = voiceResult.data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      success: true,
      context: generatedContext,
      voiceGuide,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-context error:", e);
    const status = e.message?.includes("429") ? 429 : e.message?.includes("402") ? 402 : 400;
    return new Response(JSON.stringify({ error: e.message || "Erro ao extrair contexto" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
