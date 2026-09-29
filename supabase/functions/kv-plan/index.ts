import { callOpenRouterWithCascade, parseToolCall } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/storage.ts";

/**
 * Criação de KVs — the STRATEGY step. Reads the client's briefing (form
 * answers, PDF/TXT), the materials and the manual data already approved, and
 * decides the shape of the manual: which template pages the client needs,
 * how each page's usage notes change for this client, which pages must be
 * made to measure, and where every briefing answer was applied.
 *
 * Body: { projectId, briefing, notes, spec, materialsText, pages: [{ id, titulo, capitulo, tipo, nota, essencial, descricao }] }
 * Returns: { plan }  (normalized in the browser by `normalizePlan`)
 *
 * Model: settings key "brand_manual" (Admin → Modelos de IA), Claude by default.
 */

const STR_LIST = (desc: string) => ({ type: "array", items: { type: "string" }, description: desc });

const TOOL = {
  type: "function",
  function: {
    name: "report_plan",
    description: "Return the structure of the brand manual shaped by the client's briefing",
    parameters: {
      type: "object",
      properties: {
        diagnostico: {
          type: "object",
          description: "What the briefing says, distilled (becomes the 'Contexto do briefing' page)",
          properties: {
            problema: { type: "string", description: "The client's customer problem the brand solves, 1-2 sentences, max 220 chars" },
            persona: { type: "string", description: "Who the design must impact (decision maker), max 240 chars" },
            atributos: STR_LIST("Up to 3-4 visual language attributes (1-3 words each)"),
            naoTransmitir: STR_LIST("What the brand must NOT look like (1-3 words each)"),
            restricoes: STR_LIST("Hard rules: forbidden colors, terms, brand safety, compliance (max 140 chars each)"),
            tomDeVoz: { type: "string", description: "Tone of voice for the creatives, max 200 chars" },
          },
          required: ["problema", "persona", "atributos", "naoTransmitir", "restricoes", "tomDeVoz"],
        },
        estrategia: {
          type: "object",
          properties: {
            incluir: { type: "boolean", description: "Open the manual with a strategy chapter (true when the briefing has substance)" },
            titulo: { type: "string", description: "Chapter title, e.g. 'Estratégia de comunicação'" },
            texto: { type: "string", description: "Chapter opening paragraph, max 380 chars" },
          },
          required: ["incluir", "titulo", "texto"],
        },
        paginas: {
          type: "array",
          description: "Template pages to REMOVE (incluir=false) or explicitly keep with a reason. Pages not listed stay.",
          items: {
            type: "object",
            properties: { id: { type: "string" }, incluir: { type: "boolean" }, motivo: { type: "string", description: "Why, citing the briefing, max 160 chars" } },
            required: ["id", "incluir", "motivo"],
          },
        },
        notas: {
          type: "array",
          description: "Rewritten 'Orientações de uso' for template pages whose guidance changes because of the briefing (only pages with nota=true)",
          items: {
            type: "object",
            properties: { id: { type: "string" }, texto: { type: "string", description: "2-4 sentences, max 480 chars. **bold** allowed" } },
            required: ["id", "texto"],
          },
        },
        divisores: {
          type: "array",
          description: "Rewritten chapter openings (divider pages: marca, banners, banners-exemplos, lp, lp-exemplo)",
          items: { type: "object", properties: { id: { type: "string" }, texto: { type: "string", description: "max 380 chars" } }, required: ["id", "texto"] },
        },
        extras: {
          type: "array",
          description: "Pages made to measure for this client (0-6). Only when they carry briefing content the template can't hold.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "kebab-case, unique" },
              titulo: { type: "string", description: "Page title, max 50 chars" },
              depoisDe: { type: "string", description: "Page id it follows: a template page id, another extra's id, or 'estrategia' (strategy chapter)" },
              layout: { type: "string", enum: ["cards", "persona", "tabela", "fazer_nao_fazer", "checklist", "texto"] },
              intro: { type: "string", description: "One paragraph, max 280 chars" },
              itens: {
                type: "array",
                description: "cards: 2-4 · persona: 1-3 · tabela: 3-6 rows · checklist: 4-6 · texto: 2-4 blocks",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string", description: "max 60 chars" },
                    texto: { type: "string", description: "max 220 chars" },
                    lista: STR_LIST("0-4 bullets, max 100 chars each (persona: what they need to see; tabela: 3rd column)"),
                  },
                  required: ["titulo", "texto", "lista"],
                },
              },
              colunas: STR_LIST("tabela only: 2 or 3 column headers"),
              fazer: STR_LIST("fazer_nao_fazer only: 4-6 items"),
              naoFazer: STR_LIST("fazer_nao_fazer only: 4-6 items"),
              nota: { type: "string", description: "Optional 'Orientações de uso', max 400 chars" },
            },
            required: ["id", "titulo", "depoisDe", "layout", "intro", "itens"],
          },
        },
        cobertura: {
          type: "array",
          description: "One entry per briefing answer (all of them, in order)",
          items: {
            type: "object",
            properties: {
              pergunta: { type: "string", description: "The question, shortened (max 120 chars)" },
              resposta: { type: "string", description: "The answer, shortened (max 200 chars)" },
              aplicacao: { type: "string", description: "What changed in the manual because of it, or why nothing changed (max 240 chars)" },
              paginas: STR_LIST("Page ids where it was applied (template ids, extra ids, 'contexto')"),
              status: { type: "string", enum: ["aplicado", "parcial", "sem_acao"] },
            },
            required: ["pergunta", "resposta", "aplicacao", "paginas", "status"],
          },
        },
        pendencias: STR_LIST("Questions to take back to the client: vague or contradictory answers, attachments that weren't sent (max 6)"),
      },
      required: ["diagnostico", "estrategia", "paginas", "notas", "divisores", "extras", "cobertura", "pendencias"],
    },
  },
};

const SYSTEM = `Você é diretor de arte e estrategista sênior da Agência Mestre. Antes de criar o "Manual de Comunicação Digital" de um cliente, a agência envia um BRIEFING de criação; você lê as respostas e decide a FORMA do manual.

O manual NÃO é um template com textos trocados. A biblioteca de páginas (lista "pages") é o repertório confiável da agência; você decide o que este cliente precisa, reescreve as orientações para o contexto dele e cria páginas sob medida quando o briefing pede algo que o repertório não comporta.

Como decidir:
1. Diagnóstico: destile o briefing (problema do cliente final, persona decisora, atributos, o que a marca NÃO quer parecer, restrições, tom). Use as palavras do cliente, reescritas com clareza. Nada de inventar dados; se a resposta for vaga ("todos os públicos"), diga isso de forma útil e registre em "pendencias".
2. Páginas do repertório: mantenha tudo que a marca precisa para produzir. Remova capítulos/páginas só com motivo claro no briefing ou nos materiais (ex.: o cliente não usa landing pages; só produz para Instagram; sem símbolo separável → "logo reduzido" perde sentido). Na dúvida, mantenha. Nunca remova capa, sumário, logotipo e cores primárias.
3. Orientações de uso ("notas"): reescreva as das páginas afetadas pelo briefing — ex.: sub-marcas citadas (como usar a assinatura com elas), "usar as cores do brandbook" (regra de cor), "não parecer caro/inacessível" (tom visual, CTA acessível), "conteúdos técnicos e confiáveis" (tipografia/imagens), formatos preferidos. Textos concretos, 2 a 4 frases, sem repetir o que a página já mostra.
4. Páginas sob medida ("extras", 0 a 6): crie quando houver conteúdo real do briefing para elas. Exemplos: "Persona decisora" (layout persona), "Mensagens e provas" (tabela: mensagem · como mostrar · CTA), "Produtos e tecnologia no criativo" (cards), "Banco de imagens: critérios de seleção" (fazer_nao_fazer, com termos de busca) quando o cliente não tem fotos próprias, "Arquitetura de marca / sub-marcas" (cards), "Restrições e brand safety" (checklist), "Referências visuais" (cards). Coloque cada uma onde ela é lida com mais proveito ("depoisDe"): estratégia → 'estrategia'; imagens → depois de 'imagens-exemplos'; produto/sub-marcas → depois de 'logo-usos-indevidos' ou 'cta'; banners → depois de 'banners-tipo-fb-feed'. Não crie página que só repete o diagnóstico.
5. Respeite limites de texto (cada slide é 1920×1080 e o texto precisa caber): títulos curtos, itens objetivos. Português do Brasil, sem jargão vazio ("sinergia", "potencializar").
6. Cobertura: TODAS as respostas do briefing, na ordem, dizendo onde foram aplicadas (ids das páginas) — "aplicado", "parcial" (aplicado com ressalva ou dependendo do cliente) ou "sem_acao" (ex.: "não" em restrições — diga por que não muda nada). Anexos em links (Drive) que não chegaram nos materiais viram pendência.
7. Coerência com o resumo aprovado ("spec"): use as mesmas cores, nomes, CTAs e tom. Se o briefing contradiz o spec (ex.: cor proibida no spec), aponte em "pendencias".`;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const { projectId } = body;
    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const briefing = typeof body.briefing === "string" ? body.briefing.slice(0, 16000) : "";
    if (!briefing.trim()) return jsonResponse({ error: "Envie o briefing do cliente para montar a estrutura." }, 400);

    const { data: project } = await adminClient().from("projects").select("name, context").eq("id", projectId).maybeSingle();
    const pages = Array.isArray(body.pages) ? body.pages.slice(0, 60) : [];
    const spec = body.spec && typeof body.spec === "object" ? body.spec : {};

    const prompt = [
      `## Cliente: ${String((spec as any).marca || project?.name || "—")}`,
      project?.context ? `## Contexto do projeto na plataforma\n${String(project.context).slice(0, 2500)}` : "",
      `## Briefing do cliente (fonte principal)\n${briefing}`,
      body.notes ? `## Observações do designer\n${String(body.notes).slice(0, 3000)}` : "",
      `## Resumo aprovado do manual (spec)\n${JSON.stringify(spec).slice(0, 9000)}`,
      body.materialsText ? `## Texto dos materiais do cliente (PDFs, brandbook)\n${String(body.materialsText).slice(0, 8000)}` : "",
      `## Repertório de páginas ("pages")\n${pages.map((p: any) =>
        `- ${p.id} [${p.tipo}${p.capitulo ? `, cap. ${p.capitulo}` : ""}${p.essencial ? ", essencial" : ""}${p.nota ? ", tem orientação" : ""}] ${p.titulo}: ${p.descricao}`).join("\n")}`,
    ].filter(Boolean).join("\n\n");

    const result = await callOpenRouterWithCascade({
      settingsKey: "brand_manual",
      track: { functionName: "kv-plan", projectId, userId: authed.userId },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "report_plan" } },
      temperature: 0.4,
      timeoutMs: 100000,
      budgetMs: 140000,
    });

    if (!result.ok) {
      const status = result.status === 402 || result.status === 429 ? result.status : 502;
      return jsonResponse({ error: status === 402 ? "Créditos insuficientes na OpenRouter." : "A IA não conseguiu montar a estrutura agora." }, status);
    }
    const plan = parseToolCall<Record<string, unknown>>(result.data);
    if (!plan?.diagnostico) return jsonResponse({ error: "A IA não retornou a estrutura em formato válido. Tente de novo." }, 502);

    return jsonResponse({ success: true, plan, model: result.modelUsed, costUsd: result.costUsd });
  } catch (e) {
    console.error("kv-plan error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
