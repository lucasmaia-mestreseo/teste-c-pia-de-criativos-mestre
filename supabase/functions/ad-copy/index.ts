import { callOpenRouterWithCascade, parseToolCall } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, signStorageUrl } from "../_shared/storage.ts";

/**
 * Copy do anúncio — writes the ad text that goes WITH a creative: Meta Ads,
 * Instagram caption, LinkedIn and Google Ads, within each platform's limits,
 * in the brand's voice (project context + voice guide, incl. manual guidelines).
 * Stored in generated_creatives.generation_meta.adCopy.
 *
 * Body: { projectId, creativeId, objetivo?, observacoes? }
 */

const OBJETIVOS: Record<string, string> = {
  conversao: "Conversão (venda/cadastro): urgência honesta, benefício concreto, CTA direto",
  leads: "Geração de leads: proposta de valor clara e um motivo para deixar o contato",
  trafego: "Tráfego: curiosidade e promessa do que a pessoa encontra ao clicar",
  reconhecimento: "Reconhecimento de marca: memorável, posicionamento e tom antes de oferta",
};

const TOOL = {
  type: "function",
  function: {
    name: "report_ad_copy",
    description: "Ad copy for the creative, per platform",
    parameters: {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: {
            textoPrincipal: { type: "string", description: "Primary text. First 125 chars must work alone (it is cut there)." },
            titulo: { type: "string", description: "Headline, max 40 chars" },
            descricao: { type: "string", description: "Description, max 30 chars" },
            botao: { type: "string", enum: ["Saiba mais", "Fale conosco", "Enviar mensagem", "Cadastre-se", "Comprar agora", "Solicitar orçamento", "Baixar", "Inscreva-se", "Ver mais"] },
          },
          required: ["textoPrincipal", "titulo", "descricao", "botao"],
        },
        instagram: {
          type: "object",
          properties: {
            legenda: { type: "string", description: "Caption with line breaks, first line is the hook, max ~600 chars, max 2 emojis" },
            hashtags: { type: "array", items: { type: "string" }, description: "5-8 relevant hashtags without #" },
          },
          required: ["legenda", "hashtags"],
        },
        linkedin: { type: "object", properties: { texto: { type: "string", description: "Professional tone, 2-4 short paragraphs" } }, required: ["texto"] },
        google: {
          type: "object",
          properties: {
            titulos: { type: "array", items: { type: "string" }, description: "5 headlines, max 30 chars each" },
            descricoes: { type: "array", items: { type: "string" }, description: "2 descriptions, max 90 chars each" },
          },
          required: ["titulos", "descricoes"],
        },
        variacoes: {
          type: "array",
          description: "3 alternative angles for A/B testing the primary text",
          items: {
            type: "object",
            properties: { angulo: { type: "string" }, textoPrincipal: { type: "string" }, titulo: { type: "string" } },
            required: ["angulo", "textoPrincipal", "titulo"],
          },
        },
      },
      required: ["meta", "instagram", "linkedin", "google", "variacoes"],
    },
  },
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { projectId, creativeId, objetivo, observacoes } = await req.json();
    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const db = adminClient();

    const { data: creative } = await db.from("generated_creatives").select("*").eq("id", creativeId).maybeSingle();
    if (!creative || creative.project_id !== projectId) return jsonResponse({ error: "Criativo não encontrado" }, 404);
    const { data: project } = await db.from("projects").select("name, context, voice_guide").eq("id", projectId).maybeSingle();

    const image = await signStorageUrl(db, creative.image_url);
    const briefing = creative.briefing ? `\nBriefing do criativo: ${JSON.stringify(creative.briefing).slice(0, 800)}` : "";
    const text = `Você é redator sênior de performance da agência Mestre. Escreva a copy que acompanha o criativo da imagem, em português do Brasil.

Marca/projeto: ${project?.name ?? ""}
${project?.context ? `Contexto e diretrizes da marca:\n${String(project.context).slice(0, 3000)}` : ""}
${project?.voice_guide ? `Tom de voz:\n${String(project.voice_guide).slice(0, 1500)}` : ""}
Objetivo da campanha: ${OBJETIVOS[objetivo] ?? OBJETIVOS.conversao}
${observacoes ? `Observações do designer: ${String(observacoes).slice(0, 600)}` : ""}
Pedido original do criativo: ${String(creative.prompt ?? "").slice(0, 800)}${briefing}

Regras:
- A copy COMPLEMENTA a imagem: não repita literalmente a headline da peça; leia a peça e continue a conversa.
- Respeite os limites: Meta título ≤ 40, descrição ≤ 30, Google títulos ≤ 30 e descrições ≤ 90 caracteres. Conte os caracteres.
- Sem promessas que a marca não pode cumprir, sem clickbait, sem CAIXA ALTA gritando. No máximo 2 emojis na legenda e só se combinarem com o tom.
- Use o CTA coerente com o objetivo.`;

    const result = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
      track: { functionName: "ad-copy", projectId, userId: authed.userId },
      messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: image } }] }],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "report_ad_copy" } },
    });
    if (!result.ok) {
      const status = result.status === 402 || result.status === 429 ? result.status : 502;
      return jsonResponse({ error: "Não foi possível escrever a copy agora." }, status);
    }
    const copy = parseToolCall<Record<string, unknown>>(result.data);
    if (!copy) return jsonResponse({ error: "A IA não retornou a copy em formato válido." }, 502);

    const adCopy = { ...copy, objetivo: objetivo ?? "conversao", geradoEm: new Date().toISOString(), model: result.modelUsed };
    const meta = { ...(creative.generation_meta ?? {}), adCopy };
    await db.from("generated_creatives").update({ generation_meta: meta }).eq("id", creativeId);

    return jsonResponse({ success: true, adCopy });
  } catch (e) {
    console.error("ad-copy error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
