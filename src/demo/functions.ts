/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MODO DEMO — simulated Edge Functions. Same request/response shapes as the
 * real ones in supabase/functions/, but images are placeholders and nothing
 * leaves the browser.
 */
import { adArt } from './svgArt';
import { DEMO_USER, storagePublicUrl, type Row } from './seed';
import { newId, persist, state, table } from './store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Image calls feel like real ones (but faster). */
const IMAGE_DELAY = 2500;

const kitOf = (projectId: string) => table('brand_kits').find((k) => k.project_id === projectId) ?? {};

function track(functionName: string, projectId: string | null, model: string, cost: number, settingsKey: string) {
  table('ai_usage').push({
    id: newId(), created_at: new Date().toISOString(), function_name: functionName, settings_key: settingsKey,
    model, project_id: projectId, user_id: DEMO_USER.id, success: true, status_code: 200,
    prompt_tokens: 1400, completion_tokens: 350, cost_usd: cost, duration_ms: IMAGE_DELAY,
  });
}

function storeImage(projectId: string, prefix: string, dataUrl: string): string {
  const path = `${projectId}/${prefix}${newId()}.svg`;
  state.storage[`generated-creatives/${path}`] = dataUrl;
  return storagePublicUrl('generated-creatives', path);
}

function resolveStorage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  return m ? state.storage[`${m[1]}/${decodeURIComponent(m[2])}`] ?? null : null;
}

function insertCreative(row: Row): Row {
  const full = {
    id: newId(), favorite: false, swipe_file_id: null, parent_creative_id: null, source_image_url: null,
    briefing: null, review: null, review_status: null, created_by: DEMO_USER.id,
    created_at: new Date().toISOString(), ...row,
  };
  table('generated_creatives').push(full);
  persist();
  return full;
}

/** First quoted text in the prompt, or its beginning — used as the placeholder headline. */
function headlineFrom(prompt: string, fallback: string): string {
  const quoted = prompt.match(/["“]([^"”]{3,60})["”]/);
  if (quoted) return quoted[1];
  const clean = prompt.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 48) : fallback;
}

/** Wrap an existing image into a new canvas, as a stand-in for an AI adaptation. */
function reframeArt(source: string, format: string, badge: string): string {
  const dims: Record<string, [number, number]> = { '9:16': [540, 960], '4:5': [640, 800], '1:1': [720, 720], '16:9': [960, 540] };
  const [w, h] = dims[format] ?? dims['1:1'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#161616"/>
<image href="${source}" xlink:href="${source}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" opacity="0.25"/>
<image href="${source}" xlink:href="${source}" x="${w * 0.04}" y="${h * 0.04}" width="${w * 0.92}" height="${h * 0.92}" preserveAspectRatio="xMidYMid meet"/>
<rect x="${w - 210}" y="16" width="194" height="34" rx="17" fill="#000" opacity="0.6"/>
<text x="${w - 113}" y="39" text-anchor="middle" font-family="Inter, Arial" font-size="16" fill="#fff">${badge} · ${format}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SAMPLE_ISSUES = [
  { severity: 'alta', category: 'texto', description: 'A headline tem uma letra deformada na segunda palavra.', fix_instruction: 'Reescrever a headline com letras nítidas, mesma fonte e posição.' },
  { severity: 'media', category: 'logo', description: 'O logo está muito próximo da borda.', fix_instruction: 'Afastar o logo cerca de 4% da borda, sem cortar.' },
  { severity: 'baixa', category: 'cores', description: 'O botão usa um tom levemente diferente da cor primária.', fix_instruction: 'Aplicar exatamente a cor primária do brand kit no botão.' },
];

const BRIEFINGS: Record<string, string[]> = {
  conservative: ['Resultados reais, sem enrolação', 'Mais de 2 mil clientes satisfeitos', 'Garantia de satisfação'],
  innovative: ['E se hoje fosse o primeiro dia?', 'A rotina que cabe na sua agenda', 'Seu futuro agradece'],
  radical: ['Pare de adiar. Sério.', 'Ninguém liga pra sua desculpa', 'Isso não é um anúncio. É um convite.'],
};

type Handler = (body: any) => Promise<any>;

const handlers: Record<string, Handler> = {
  'generate-creative': async (b) => {
    await sleep(IMAGE_DELAY);
    const kit = kitOf(b.projectId);
    const fieldValues = Object.values(b.templateFields ?? {}).filter(Boolean) as string[];
    const title = headlineFrom(b.prompt || '', fieldValues[0] || 'Novo criativo');
    const cta = [...(b.prompt || '').matchAll(/["“]([^"”]{2,30})["”]/g)][1]?.[1];
    const model = 'openai/gpt-5.4-image-2';
    const cost = 0.045;
    const imageUrl = storeImage(b.projectId, '', adArt({
      format: b.format, title, cta, primary: kit.primary_color, secondary: kit.secondary_color, background: kit.background_color,
      variant: table('generated_creatives').length,
    }));
    const row = insertCreative({
      project_id: b.projectId, swipe_file_id: b.swipeFileId ?? null, image_url: imageUrl,
      prompt: b.prompt || fieldValues.join(' · ') || title, format: b.format, kind: 'generate',
      model_used: model, cost_usd: cost,
      generation_meta: { mode: b.mode, format: b.format, hasLogo: !!b.brandKit?.logoUrl, hasPerson: !!(b.brandKit?.personPhotoUrl || b.brandKit?.personGridUrl) },
    });
    track('generate-creative', b.projectId, model, cost, 'image_generation');
    return { success: true, imageUrl, creativeId: row.id, model, costUsd: cost };
  },

  'generate-dynamic-creative': async (b) => {
    const kit = b.ignoreBrandKit ? {} : kitOf(b.projectId);
    const results: any[] = [];
    for (const { type, count } of b.types ?? []) {
      for (let i = 0; i < Math.min(Math.max(1, count), 5); i++) {
        await sleep(IMAGE_DELAY);
        const pool = BRIEFINGS[type] ?? BRIEFINGS.innovative;
        const titulo = pool[(table('generated_creatives').length + i) % pool.length];
        const briefing = { titulo, copy: 'Texto de apoio persuasivo gerado como exemplo no modo demo.', proposta_imagem: 'Pessoa em destaque, fundo limpo e CTA forte.', objetivo_estrategico: 'Gerar cliques' };
        const imageUrl = storeImage(b.projectId, 'dynamic-', adArt({ format: b.format || '1:1', title: titulo, primary: kit.primary_color, secondary: kit.secondary_color, background: kit.background_color, variant: i }));
        const row = insertCreative({
          project_id: b.projectId, image_url: imageUrl, prompt: `[${type}] ${titulo}`, format: b.format || '1:1', kind: 'dynamic',
          briefing: { type, ...briefing }, model_used: 'google/gemini-3.1-flash-image-preview', cost_usd: 0.042,
          generation_meta: { mode: 'dynamic', format: b.format, hasLogo: !!b.includeLogo },
        });
        track('generate-dynamic-creative', b.projectId, 'google/gemini-3-flash-preview', 0.002, 'text_reasoning');
        track('generate-dynamic-creative', b.projectId, 'google/gemini-3.1-flash-image-preview', 0.04, 'image_generation');
        results.push({ type, briefing, imageUrl, creativeId: row.id });
      }
    }
    return { success: true, results, truncated: false };
  },

  'transform-creative': async (b) => {
    await sleep(IMAGE_DELAY);
    const parent = b.creativeId ? table('generated_creatives').find((c) => c.id === b.creativeId) : null;
    const sourceUrl: string | null = parent ? parent.image_url : b.sourceImageUrl;
    const source = resolveStorage(sourceUrl);
    if (!source) throw new Error('Imagem de origem não encontrada (demo)');
    const op: 'resize' | 'unfold' | 'fix' = b.operation;
    const format = op === 'fix' ? (parent?.format ?? '1:1') : b.targetFormat;
    const label = op === 'fix' ? 'Corrigido' : op === 'resize' ? 'Redimensionado' : 'Desdobramento';
    const imageUrl = storeImage(b.projectId, `${op}-`, reframeArt(source, format, label));
    const row = insertCreative({
      project_id: b.projectId, image_url: imageUrl, format, kind: op,
      prompt: `[${label} → ${format}]${b.instructions ? ` ${b.instructions}` : ''}`,
      parent_creative_id: parent?.id ?? null,
      source_image_url: op === 'unfold' ? (parent ? (parent.source_image_url ?? parent.image_url) : sourceUrl) : (parent?.source_image_url ?? null),
      model_used: 'openai/gpt-5.4-image-2', cost_usd: 0.042,
      generation_meta: { operation: op, sourceFormat: parent?.format ?? b.sourceFormat ?? null, targetFormat: format },
    });
    track(`transform-creative:${op}`, b.projectId, 'openai/gpt-5.4-image-2', 0.042, 'image_generation');
    return { success: true, creativeId: row.id, imageUrl, model: 'openai/gpt-5.4-image-2', costUsd: 0.042 };
  },

  'review-creative': async (b) => {
    const creative = table('generated_creatives').find((c) => c.id === b.creativeId);
    if (!creative) throw new Error('Criativo não encontrado');
    creative.review_status = 'pending';
    persist();
    await sleep(1500);
    // Corrections always pass; other creatives get issues about a third of the time.
    const withIssues = creative.kind !== 'fix' && Math.random() < 0.35;
    const issues = withIssues ? SAMPLE_ISSUES.slice(0, 1 + Math.floor(Math.random() * 3)) : [];
    const review = {
      approved: !issues.some((i) => i.severity === 'alta'),
      score: withIssues ? 58 + Math.floor(Math.random() * 20) : 85 + Math.floor(Math.random() * 12),
      summary: withIssues ? 'Boa composição, mas há detalhes a corrigir antes de publicar.' : 'Pronto para publicar: textos corretos e marca bem aplicada.',
      issues, model: 'google/gemini-2.5-flash', cost_usd: 0.0015, reviewed_at: new Date().toISOString(),
    };
    creative.review = review;
    creative.review_status = review.approved ? 'approved' : 'issues';
    persist();
    track('review-creative', creative.project_id, 'google/gemini-2.5-flash', 0.0015, 'vision_analysis');
    return { success: true, review };
  },

  'analyze-swipe': async (b) => {
    await sleep(1200);
    const analysis = {
      texts: [
        { id: 'text_1', content: 'Oferta imperdível de verão', position: 'topo-esquerdo', role: 'headline' },
        { id: 'text_2', content: 'Condições especiais por tempo limitado', position: 'centro', role: 'subtitle' },
        { id: 'text_3', content: 'Quero agora', position: 'inferior-centro', role: 'cta' },
      ],
      logos: [{ id: 'logo_1', position: 'inferior-direito', description: 'Logo da marca de referência' }],
      photos: [{ id: 'photo_1', position: 'centro', description: 'Pessoa sorrindo, fundo neutro' }],
    };
    const swipe = table('swipe_files').find((s) => s.id === b.swipeFileId);
    if (swipe) { swipe.analysis = analysis; persist(); }
    track('analyze-swipe', swipe?.project_id ?? null, 'google/gemini-2.5-flash', 0.001, 'vision_analysis');
    return { success: true, analysis };
  },

  'suggest-texts': async (b) => {
    await sleep(900);
    const byRole: Record<string, string> = { headline: 'Seu próximo passo começa hoje', subtitle: 'Condições exclusivas para novos clientes', cta: 'Quero aproveitar', caption: 'Válido até domingo', body: 'Atendimento rápido e sem burocracia.' };
    return { suggestions: (b.texts ?? []).map((t: any) => ({ id: t.id, text: byRole[t.role] ?? 'Texto sugerido de exemplo' })) };
  },

  'suggest-creatives': async () => {
    await sleep(1200);
    return {
      suggestions: [
        { type: 'conservative', titulo: 'Resultados que você vê', copy: 'Mais de 2 mil clientes atendidos com nota 4,9.', proposta_imagem: 'Depoimento em destaque com foto do cliente.', objetivo_estrategico: 'Gerar confiança' },
        { type: 'innovative', titulo: 'E se fosse hoje?', copy: 'Imagine o primeiro dia da sua nova rotina.', proposta_imagem: 'Antes e depois em tela dividida.', objetivo_estrategico: 'Despertar curiosidade' },
        { type: 'radical', titulo: 'Pare de adiar.', copy: 'A desculpa de amanhã é a mesma de ontem.', proposta_imagem: 'Tipografia gigante, fundo sólido na cor primária.', objetivo_estrategico: 'Ação imediata' },
      ],
    };
  },

  'extract-context': async () => {
    await sleep(2000);
    return {
      success: true,
      context: 'Empresa fictícia (modo demo). Atua com serviços para o público adulto da região, com foco em atendimento próximo e preço acessível.',
      voiceGuide: 'Tom próximo e confiante, frases curtas, sem jargão.',
    };
  },

  'extract-branding': async () => {
    await sleep(1200);
    return { primary_color: '#FFF95A', secondary_color: '#111111', background_color: '#1C1C1C', aux_colors: ['#FFFFFF', '#8A8A8A'], typography: 'Space Grotesk, Inter' };
  },

  'extract-design-system': async () => {
    await sleep(1500);
    return { success: true, screenshotUrl: '', primary_color: '#FFF95A', secondary_color: '#111111', background_color: '#1C1C1C', aux_colors: ['#FFFFFF'], typography: 'Space Grotesk' };
  },

  'generate-person-grid': async (b) => {
    await sleep(IMAGE_DELAY);
    const path = `${b.projectId}/grid-${newId()}.svg`;
    state.storage[`people-photos/${path}`] = adArt({ format: '16:9', title: 'Grid 3x3 da pessoa (exemplo)', cta: 'Demo' });
    persist();
    return { success: true, gridUrl: storagePublicUrl('people-photos', path) };
  },

  'list-openrouter-models': async () => {
    const m = (id: string, input: string[], output: string[], prompt: number, completion: number) => ({ id, name: id, context_length: 128000, pricing: { prompt, completion }, input_modalities: input, output_modalities: output });
    return {
      image_generation: [m('openai/gpt-5.4-image-2', ['text', 'image'], ['image', 'text'], 5e-6, 4e-5), m('google/gemini-3.1-flash-image-preview', ['text', 'image'], ['image', 'text'], 3e-7, 3e-5)],
      text_reasoning: [m('google/gemini-3-flash-preview', ['text'], ['text'], 3e-7, 2.5e-6), m('openai/gpt-5.4-mini', ['text'], ['text'], 4e-7, 1.6e-6)],
      vision_analysis: [m('google/gemini-2.5-flash', ['text', 'image'], ['text'], 3e-7, 2.5e-6)],
      synced_at: new Date().toISOString(),
    };
  },

  'kv-analyze': async (b) => {
    await sleep(3500);
    const project = table('projects').find((p) => p.id === b.projectId);
    const notes: string = b.notes || '';
    const named = notes.match(/(?:marca|cliente)\s*[:\-–]\s*([^\n.,;]{2,40})/i)?.[1]?.trim();
    const marca = named || project?.name || 'Marca';
    const cands: { hex: string; share: number; source: string }[] = b.paletteCandidates ?? [];
    // chroma: HSL saturation is unstable near white/black
    const sat = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
      return Math.max(r, g, bl) - Math.min(r, g, bl);
    };
    const lum = (hex: string) => { const [r, g, bl] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
    const brandy = cands.filter((c) => !/neutro/.test(c.source) && sat(c.hex) > 0.2);
    const byDark = [...brandy].sort((a, c) => lum(a.hex) - lum(c.hex));
    const principal = byDark[0]?.hex ?? '#1B2752';
    const acento = [...brandy].sort((a, c) => sat(c.hex) * lum(c.hex) - sat(a.hex) * lum(a.hex)).find((c) => c.hex !== principal)?.hex ?? '#F2A900';
    const apoio = byDark.find((c) => c.hex !== principal && c.hex !== acento)?.hex ?? '#3F61AA';
    const family = (b.fontsFound?.[0] as string | undefined)?.replace(/\s+(Regular|Bold|Light|Medium|SemiBold|Black|Italic).*$/i, '') || 'Montserrat';
    const images = (b.images ?? []).map((img: any) => {
      const label = String(img.label).toLowerCase();
      if (/logo|marcado como logo/.test(label)) return { id: img.id, tipo: 'logo', foco: { x: 0.5, y: 0.5 } };
      if (/s[ií]mbolo/.test(label)) return { id: img.id, tipo: 'simbolo', foco: { x: 0.5, y: 0.5 } };
      if (/foto|marcado como foto/.test(label)) return { id: img.id, tipo: 'foto', foco: { x: 0.5, y: 0.38 } };
      if (/página/.test(label)) return { id: img.id, tipo: 'pagina', foco: { x: 0.5, y: 0.5 }, fotos: [{ x0: 0.52, y0: 0.18, x1: 0.95, y1: 0.82 }] };
      return { id: img.id, tipo: 'peca', foco: { x: 0.5, y: 0.45 } };
    });
    track('kv-analyze', b.projectId, 'google/gemini-3-flash-preview', 0.018, 'text_reasoning');
    return {
      success: true,
      images,
      spec: {
        marca, produto: marca, slogan: `${marca}: do jeito certo, desde o começo.`,
        headlinePrincipal: 'Qualidade que você percebe no primeiro contato',
        headlineSecundaria: 'Feito para durar',
        headlineTerceira: 'Especialistas no que importa para você',
        posicionamento: `${marca}, referência no que faz`,
        textoDeApoio: 'Atendimento próximo, prazos cumpridos e resultado de verdade.',
        cores: {
          principal: { hex: principal, nome: 'Cor institucional', uso: 'Fundos, títulos e assinatura' },
          apoio: { hex: apoio, nome: 'Cor de apoio', uso: 'Títulos, links e cards' },
          acento: { hex: acento, nome: 'Cor de destaque', uso: 'CTA e destaques' },
          paleta: [],
          nota: `A cor institucional domina; o destaque aparece só em CTAs e grifos.${/vermelho nunca/i.test(notes) ? ' A marca evita vermelho.' : ''}`,
        },
        tipografia: {
          primaria: family, secundaria: family, auxiliarPrimaria: 'Arial', auxiliarSecundaria: 'Georgia',
          nota: b.fontsFound?.length ? '' : 'Materiais sem fonte embutida: tipografia inferida pela aparência (modo demo).',
        },
        cta: { institucional: 'CONHEÇA', principal: 'FALE COM A GENTE', secundario: 'SAIBA MAIS', material: 'BAIXE O CATÁLOGO', demo: 'PEÇA UM ORÇAMENTO', solucoes: 'VER SERVIÇOS' },
        lp: {
          subtituloHero: 'Soluções sob medida, com atendimento de quem entende do assunto.',
          tituloSecao1: 'O que a gente faz de melhor', tituloSecao2: 'Por que escolher a ' + marca,
          textoSecao2: 'Experiência, processo claro e um time que acompanha cada etapa até a entrega.',
          cards: [
            { titulo: 'Experiência', texto: 'Anos de mercado e clientes que voltam.' },
            { titulo: 'Agilidade', texto: 'Prazos combinados e cumpridos.' },
            { titulo: 'Proximidade', texto: 'Atendimento direto, sem intermediários.' },
          ],
          menu: ['Sobre', 'Serviços', 'Clientes', 'Contato'],
          rodapeLinks: 'Serviços · Clientes · Contato',
        },
        imagens: {
          fazer: ['Luz natural e cenários reais do negócio.', 'Pessoas em ação, olhando para o trabalho.', 'Enquadramento com respiro para texto.', 'Cores da paleta presentes na cena.', 'Detalhes do produto em primeiro plano.', 'Fundos limpos, sem poluição visual.'],
          naoFazer: ['Banco de imagem genérico e posado.', 'Recortes que cortam o rosto.', 'Texto sobre o rosto ou o produto.', 'Filtros saturados fora da paleta.', 'Ambientes escuros e sem contraste.', 'Mais de uma assinatura na mesma peça.'],
        },
        criativos: [
          ['Fundo na cor institucional com degradê sutil.', 'Headline em caixa alta, até 3 linhas.', 'Assinatura negativa no rodapé.', 'CTA na cor de destaque.', 'Foto recortada com respiro.', 'Uma assinatura por peça.'],
          ['Versão clara, fundo off-white.', 'Logo colorido abaixo dos 220 px da interface.', 'Título grande na cor institucional.', 'Imagem no centro, sem cortar rostos.', 'CTA acima dos 320 px finais.', 'Todo o texto na área segura.'],
          ['Duas colunas: bloco de cor e foto.', 'Texto só no bloco de cor.', 'Foto com o rosto dentro da coluna.', 'Assinatura no bloco, nunca sobre a foto.', 'Headline curta, até 3 linhas.', 'CTA abaixo do título.'],
        ],
        resumo: {
          direcaoVisual: 'Visual limpo e confiante, com a cor institucional dominante e acento pontual.',
          tomDeVoz: 'Direto, próximo e seguro — sem jargão.',
          publico: 'Decisores que valorizam qualidade e atendimento.',
        },
        inferencias: ['Modo demo: análise simulada a partir das cores medidas e das fontes encontradas.', b.fontsFound?.length ? `Tipografia tirada das fontes embutidas (${family}).` : 'Tipografia padrão (sem PDF com fontes).'],
        pendencias: ['Logo em vetor (SVG/AI) para máxima nitidez.', 'Fotos próprias da marca em alta resolução.'],
      },
    };
  },

  'admin-list-users': async () => table('profiles').map((p) => ({ id: p.user_id, email: p.email, email_confirmed_at: p.created_at, created_at: p.created_at })),
};

export async function runDemoFunction(name: string, body: any): Promise<any> {
  const handler = handlers[name];
  if (handler) return handler(body);
  // Admin actions (invite, reset password, delete user...) just succeed in the demo.
  await sleep(400);
  return { success: true };
}
