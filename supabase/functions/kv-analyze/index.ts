import { callOpenRouterWithCascade, parseToolCall } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/storage.ts";

/**
 * Criação de KVs — reads the client's materials and returns the DATA of the
 * brand manual (the layout is a fixed 38-page template filled in the browser).
 *
 * Body: {
 *   projectId, notes, pdfText, fontsFound: string[],
 *   paletteCandidates: { hex, share, source }[],
 *   images: { id, label, dataUrl }[]   // logos, creatives, PDF pages (JPEG ≤1024px)
 * }
 * Returns: { spec, images: [{ id, tipo, foco, simboloBox?, fotos? }] }
 */

const COLOR = {
  type: "object",
  properties: { hex: { type: "string" }, nome: { type: "string" }, uso: { type: "string" } },
  required: ["hex", "nome", "uso"],
};
const STR_LIST = (desc: string) => ({ type: "array", items: { type: "string" }, description: desc });
const BOX = {
  type: "object",
  properties: { x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } },
  required: ["x0", "y0", "x1", "y1"],
};

const TOOL = {
  type: "function",
  function: {
    name: "report_manual",
    description: "Return the brand manual data and the classification of each image",
    parameters: {
      type: "object",
      properties: {
        spec: {
          type: "object",
          properties: {
            marca: { type: "string" },
            produto: { type: "string", description: "Main product/service name (or the brand again)" },
            slogan: { type: "string" },
            headlinePrincipal: { type: "string", description: "Max ~60 chars" },
            headlineSecundaria: { type: "string", description: "Max ~50 chars" },
            headlineTerceira: { type: "string", description: "Max ~60 chars" },
            posicionamento: { type: "string", description: "LP hero h1, max ~45 chars (2 lines)" },
            textoDeApoio: { type: "string", description: "One sentence, max ~110 chars" },
            cores: {
              type: "object",
              properties: {
                principal: COLOR, apoio: COLOR, acento: COLOR,
                profundo: { type: "string", description: "Optional darker brand hex" },
                paleta: { type: "array", items: COLOR, description: "Official palette, 4-8 colors incl. neutrals, only if evidenced" },
                nota: { type: "string", description: "Which color dominates, supports and accents; restrictions" },
              },
              required: ["principal", "apoio", "acento", "paleta", "nota"],
            },
            tipografia: {
              type: "object",
              properties: {
                primaria: { type: "string", description: "Google Fonts family name" },
                secundaria: { type: "string", description: "Google Fonts family name (may equal primaria)" },
                auxiliarPrimaria: { type: "string", description: "Web-safe substitute: Arial, Verdana, Tahoma, Trebuchet MS, Segoe UI, Georgia..." },
                auxiliarSecundaria: { type: "string" },
                nota: { type: "string", description: "Divergences/inferences about typography; empty if none" },
              },
              required: ["primaria", "secundaria", "auxiliarPrimaria", "auxiliarSecundaria", "nota"],
            },
            cta: {
              type: "object",
              properties: {
                institucional: { type: "string" }, principal: { type: "string" }, secundario: { type: "string" },
                material: { type: "string" }, demo: { type: "string" }, solucoes: { type: "string" },
              },
              required: ["institucional", "principal", "secundario", "material", "demo", "solucoes"],
            },
            lp: {
              type: "object",
              properties: {
                subtituloHero: { type: "string" }, tituloSecao1: { type: "string" }, tituloSecao2: { type: "string" },
                textoSecao2: { type: "string" },
                cards: { type: "array", items: { type: "object", properties: { titulo: { type: "string" }, texto: { type: "string" } }, required: ["titulo", "texto"] } },
                menu: STR_LIST("Exactly 4 short nav items"),
                rodapeLinks: { type: "string", description: "Footer links, use · between items" },
              },
              required: ["subtituloHero", "tituloSecao1", "tituloSecao2", "textoSecao2", "cards", "menu", "rodapeLinks"],
            },
            imagens: {
              type: "object",
              properties: { fazer: STR_LIST("6 do's for imagery"), naoFazer: STR_LIST("6 don'ts for imagery") },
              required: ["fazer", "naoFazer"],
            },
            criativos: { type: "array", items: STR_LIST("6 bullets"), description: "3 lists: 01 Instagram feed (dark), 02 story (light), 03 Facebook feed (text + photo columns)" },
            resumo: {
              type: "object",
              properties: { direcaoVisual: { type: "string" }, tomDeVoz: { type: "string" }, publico: { type: "string" } },
              required: ["direcaoVisual", "tomDeVoz", "publico"],
            },
            inferencias: STR_LIST("What was inferred rather than read from an official source"),
            pendencias: STR_LIST("Materials worth asking the client for"),
          },
          required: ["marca", "produto", "slogan", "headlinePrincipal", "headlineSecundaria", "headlineTerceira", "posicionamento", "textoDeApoio", "cores", "tipografia", "cta", "lp", "imagens", "criativos", "resumo", "inferencias", "pendencias"],
        },
        images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              tipo: { type: "string", enum: ["logo", "logo_tagline", "simbolo", "foto", "peca", "pagina", "outro"] },
              foco: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], description: "Main subject/face center, fractions 0-1 (for photos and pieces)" },
              simboloBox: { ...BOX, description: "For logos with a separable symbol/icon: its box, fractions 0-1" },
              fotos: { type: "array", items: BOX, description: "For pages/pieces: boxes of clean photographs (no text) worth reusing, fractions 0-1" },
            },
            required: ["id", "tipo", "foco"],
          },
        },
      },
      required: ["spec", "images"],
    },
  },
};

const SYSTEM = `Você é diretor de arte sênior da agência Mestre e monta o "Manual de Comunicação Digital" (uso interno, em português do Brasil) de clientes a partir dos materiais que eles enviam: brandbook, apresentações, logos, peças aprovadas e briefing.

Regras (vêm da experiência com os manuais já entregues):
1. Use SÓ o que os materiais evidenciam. Cores: prefira as escritas no brandbook; senão, as MEDIDAS nos pixels (lista "paletteCandidates"). Nunca invente uma cor fora das evidências. Tudo que for inferido vai em "inferencias".
2. Papéis das cores: "principal" domina (fundos, títulos, assinatura), "apoio" acompanha (títulos, links, cards), "acento" é o CTA/destaque. O acento deve ter contraste com o texto do botão; se branco sobre ele reprovar (<4,5:1), diga na nota que o texto do CTA é escuro.
3. Respeite restrições do briefing/notas (ex.: "vermelho nunca", "laranja com neutros") e registre-as na nota de cores.
4. Tipografia: se "fontsFound" (fontes embutidas nos PDFs) trouxer a família, ela é a evidência mais forte. Informe o nome da família no Google Fonts; se a fonte oficial não existir lá, escolha a equivalente mais próxima do Google Fonts e explique em tipografia.nota. As auxiliares são fontes de sistema (Arial, Verdana, Georgia...).
5. Textos: curtos, concretos e no tom da marca. Headlines sem ponto final forçado; posicionamento cabe em 2 linhas (~45 caracteres); CTAs em CAIXA ALTA com 2 a 4 palavras e verbo ("PEÇA SUA COTAÇÃO"). Nada de linguagem de software B2B ("solicite uma demo") se a marca não for de software.
6. Direção de imagem: 6 "fazer" e 6 "não fazer" específicos da marca (cenário, luz, pessoas, recortes). Inclua sempre: não cortar rostos; não pôr texto sobre o rosto.
7. Criativos (3 listas de 6 itens), descrevendo como cada peça do manual aplica a marca: 01 feed Instagram 1080×1080 em fundo escuro da marca; 02 story 1080×1920 em versão clara, respeitando as áreas da interface (220 px em cima, 320 px embaixo); 03 feed Facebook em duas colunas (bloco de cor com texto + foto). Cite cores, tipografia e o CTA.
8. Imagens: classifique cada uma (logo, logo_tagline, simbolo, foto, peca, pagina, outro). Para fotos e peças, "foco" é o centro do rosto/assunto principal. Para logos com símbolo separável, dê "simboloBox". Para páginas e peças, liste em "fotos" as caixas de FOTOGRAFIAS limpas (sem texto por cima) que valem reaproveitar.
9. "pendencias": o que falta e valeria pedir ao cliente (vetor do logo, fontes, fotos...).
10. BRIEFING DO CLIENTE (respostas do formulário de criação), quando houver, é a fonte principal para público, tom, direção de imagem e restrições: "atributos" viram direção visual; "o que a marca NÃO busca transmitir" e "o que não pode ser executado" viram itens de "naoFazer" e restrições na nota de cores; "cor que não devemos usar" nunca aparece na paleta; se o cliente não tem banco de imagens próprio, a direção de imagem orienta a escolha em bancos profissionais. Anexos citados por link (Drive) que não chegaram nos materiais vão para "pendencias".`;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const { projectId } = body;
    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const db = adminClient();
    const [{ data: project }, { data: kit }] = await Promise.all([
      db.from("projects").select("name, context, voice_guide").eq("id", projectId).maybeSingle(),
      db.from("brand_kits").select("primary_color, secondary_color, background_color, aux_colors, typography").eq("project_id", projectId).maybeSingle(),
    ]);

    const images: { id: string; label: string; dataUrl: string }[] = Array.isArray(body.images) ? body.images.slice(0, 16) : [];
    const palette = Array.isArray(body.paletteCandidates) ? body.paletteCandidates.slice(0, 24) : [];
    const fonts: string[] = Array.isArray(body.fontsFound) ? body.fontsFound.slice(0, 40) : [];

    const brief = [
      `## Projeto na plataforma: ${project?.name ?? "—"}`,
      project?.context ? `## Contexto do projeto\n${String(project.context).slice(0, 3000)}` : "",
      project?.voice_guide ? `## Tom de voz registrado\n${String(project.voice_guide).slice(0, 1500)}` : "",
      kit && (kit.primary_color || kit.typography)
        ? `## Brand Kit atual do projeto (pode estar incompleto)\nPrimária ${kit.primary_color ?? "—"}, secundária ${kit.secondary_color ?? "—"}, fundo ${kit.background_color ?? "—"}, auxiliares ${(kit.aux_colors ?? []).join(", ") || "—"}, tipografia ${kit.typography ?? "—"}`
        : "",
      body.briefing ? `## Briefing do cliente (respostas do formulário de criação)\n${String(body.briefing).slice(0, 12000)}` : "",
      body.notes ? `## Notas enviadas pelo designer\n${String(body.notes).slice(0, 6000)}` : "",
      fonts.length ? `## fontsFound (fontes embutidas nos PDFs)\n${fonts.join(", ")}` : "## fontsFound\nnenhuma (materiais rasterizados ou sem PDF)",
      palette.length
        ? `## paletteCandidates (cores medidas nos pixels, com participação)\n${palette.map((p: any) => `${p.hex} ${(Number(p.share) * 100).toFixed(1)}% (${p.source})`).join("\n")}`
        : "",
      body.pdfText ? `## Texto extraído dos PDFs\n${String(body.pdfText).slice(0, 20000)}` : "",
      `## Imagens anexadas (na ordem): ${images.map((i) => `${i.id} = ${i.label}`).join("; ") || "nenhuma"}`,
    ].filter(Boolean).join("\n\n");

    const content: any[] = [{ type: "text", text: brief }];
    for (const img of images) {
      if (typeof img?.dataUrl !== "string" || !img.dataUrl.startsWith("data:image/")) continue;
      content.push({ type: "text", text: `Imagem ${img.id} (${img.label}):` });
      content.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }

    const result = await callOpenRouterWithCascade({
      settingsKey: "text_reasoning",
      track: { functionName: "kv-analyze", projectId, userId: authed.userId },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "report_manual" } },
    });

    if (!result.ok) {
      const status = result.status === 402 || result.status === 429 ? result.status : 502;
      return jsonResponse({ error: status === 402 ? "Créditos insuficientes na OpenRouter." : "A IA não conseguiu analisar os materiais agora.", status }, status);
    }
    const parsed = parseToolCall<{ spec: unknown; images: unknown[] }>(result.data);
    if (!parsed?.spec) return jsonResponse({ error: "A IA não retornou o manual em formato válido. Tente de novo." }, 502);

    return jsonResponse({ success: true, spec: parsed.spec, images: parsed.images ?? [], model: result.modelUsed, costUsd: result.costUsd });
  } catch (e) {
    console.error("kv-analyze error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
