import { callOpenRouterWithCascade, parseToolCall } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, signStorageUrl } from "../_shared/storage.ts";

/**
 * Variações A/B — proposes N variations of a creative, each testing ONE
 * hypothesis (headline angle, CTA, or a visual element), so the test result
 * is readable. The images are then produced by transform-creative
 * (operation "variant"), one per request.
 *
 * Body: { projectId, creativeId, quantidade (2-4), foco: "mix"|"headline"|"cta"|"visual" }
 */

const FOCO: Record<string, string> = {
  mix: "Varie o ângulo da mensagem: cada variação testa UMA hipótese diferente (benefício, dor, prova social, urgência, curiosidade...).",
  headline: "Mantenha visual e CTA; varie só a headline, cada uma com um ângulo diferente.",
  cta: "Mantenha headline e visual; varie só o texto e a cor/forma do CTA dentro da paleta.",
  visual: "Mantenha os textos; varie um elemento visual por vez (enquadramento da foto, fundo, destaque, composição).",
};

const TOOL = {
  type: "function",
  function: {
    name: "report_variants",
    description: "Variations of the creative for an A/B test",
    parameters: {
      type: "object",
      properties: {
        textosAtuais: {
          type: "object",
          properties: { headline: { type: "string" }, cta: { type: "string" } },
          required: ["headline", "cta"],
          description: "Texts read from the current creative",
        },
        variacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string", description: "Short label, e.g. 'Prova social'" },
              hipotese: { type: "string", description: "What this variation tests, one sentence" },
              headline: { type: "string", description: "New headline (or the current one if unchanged)" },
              cta: { type: "string", description: "CTA text (or the current one)" },
              ajusteVisual: { type: "string", description: "Visual change, or empty if none" },
            },
            required: ["nome", "hipotese", "headline", "cta", "ajusteVisual"],
          },
        },
      },
      required: ["textosAtuais", "variacoes"],
    },
  },
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { projectId, creativeId, quantidade, foco } = await req.json();
    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const db = adminClient();
    const { data: creative } = await db.from("generated_creatives").select("*").eq("id", creativeId).maybeSingle();
    if (!creative || creative.project_id !== projectId) return jsonResponse({ error: "Criativo não encontrado" }, 404);
    const { data: project } = await db.from("projects").select("name, context, voice_guide").eq("id", projectId).maybeSingle();
    const n = Math.min(4, Math.max(2, Number(quantidade) || 3));

    const text = `Você planeja testes A/B de anúncios na agência Mestre. Leia o criativo da imagem e proponha ${n} variações para testar contra ele.

Marca: ${project?.name ?? ""}
${project?.context ? `Contexto e diretrizes:\n${String(project.context).slice(0, 2500)}` : ""}
${project?.voice_guide ? `Tom de voz:\n${String(project.voice_guide).slice(0, 1200)}` : ""}
Pedido original do criativo: ${String(creative.prompt ?? "").slice(0, 600)}

Foco do teste: ${FOCO[foco] ?? FOCO.mix}

Regras: headlines com no máximo ~60 caracteres e o mesmo tamanho aproximado da atual (o layout não muda); CTA em CAIXA ALTA com 2 a 4 palavras; nada fora das cores e do tom da marca; hipóteses diferentes entre si.`;

    const result = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
      track: { functionName: "suggest-variants", projectId, userId: authed.userId },
      messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: await signStorageUrl(db, creative.image_url) } }] }],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "report_variants" } },
    });
    if (!result.ok) {
      const status = result.status === 402 || result.status === 429 ? result.status : 502;
      return jsonResponse({ error: "Não foi possível sugerir variações agora." }, status);
    }
    const parsed = parseToolCall<{ textosAtuais: unknown; variacoes: unknown[] }>(result.data);
    if (!parsed?.variacoes?.length) return jsonResponse({ error: "A IA não retornou variações válidas." }, 502);
    return jsonResponse({ success: true, ...parsed, variacoes: parsed.variacoes.slice(0, n) });
  } catch (e) {
    console.error("suggest-variants error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
