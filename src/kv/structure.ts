/**
 * Criação de KVs — the manual's STRUCTURE, shaped by the client's briefing.
 *
 * The 38-page template is the library of pages the agency trusts; the plan
 * (`kv-plan`, reviewed by the designer) decides which of them the client
 * needs, rewrites their usage notes for the client's context and adds pages
 * made to measure (strategy, persona, messages, restrictions, image-bank
 * criteria…) rendered in the same visual language. Pages are then renumbered
 * and the table of contents is rebuilt from what is actually there.
 */

export type ChapterId = 'estrategia' | 'marca' | 'banners' | 'lp';
export type PageKind = 'capa' | 'sumario' | 'divisor' | 'subdivisor' | 'pagina';

export interface TemplatePage {
  n: number;
  id: string;
  titulo: string;
  capitulo: ChapterId | null;
  tipo: PageKind;
  /** Table-of-contents label; consecutive pages with the same label share one entry. */
  toc?: string;
  /** Always present (the manual makes no sense without it). */
  essencial?: boolean;
  /** Has an "Orientações de uso" note the plan can rewrite. */
  nota?: boolean;
  /** For the AI: what the page shows. */
  descricao: string;
}

const P = (n: number, id: string, titulo: string, capitulo: ChapterId | null, tipo: PageKind, descricao: string, extra: Partial<TemplatePage> = {}): TemplatePage =>
  ({ n, id, titulo, capitulo, tipo, descricao, ...extra });

export const TEMPLATE_PAGES: TemplatePage[] = [
  P(1, 'capa', 'Capa', null, 'capa', 'Capa com o logo em negativo sobre degradê da cor principal.', { essencial: true }),
  P(2, 'sumario', 'Sumário', null, 'sumario', 'Sumário (refeito automaticamente).', { essencial: true }),
  P(3, 'marca', 'Elementos da marca', 'marca', 'divisor', 'Abertura do capítulo de elementos da marca.'),
  P(4, 'logotipo', 'Logotipo', 'marca', 'pagina', 'Logo positivo e negativo, versão preferencial.', { toc: 'Logotipo', essencial: true, nota: true }),
  P(5, 'logo-versoes', 'Versões monocromáticas e símbolo', 'marca', 'pagina', 'Versões em uma cor e o símbolo isolado.', { toc: 'Versões monocromáticas e símbolo', nota: true }),
  P(6, 'logo-protecao', 'Área de proteção e redução mínima', 'marca', 'pagina', 'Área de respiro (X) e tamanhos mínimos em px.', { toc: 'Área de proteção e redução mínima', nota: true }),
  P(7, 'logo-usos-indevidos', 'Usos indevidos', 'marca', 'pagina', '8 exemplos do que não fazer com o logo (distorcer, recolorir, sombra…).', { toc: 'Usos indevidos', nota: true }),
  P(8, 'tipografia', 'Tipografia', 'marca', 'pagina', 'Famílias primária e secundária com pesos.', { toc: 'Tipografia', nota: true }),
  P(9, 'cores-primarias', 'Cores primárias', 'marca', 'pagina', 'Paleta oficial com HEX/RGB/CMYK.', { toc: 'Cores primárias', essencial: true, nota: true }),
  P(10, 'cores-secundarias', 'Cores secundárias', 'marca', 'pagina', 'Tons derivados para fundos, textos e estados.', { toc: 'Cores secundárias', nota: true }),
  P(11, 'cta', 'Call to Action (CTA)', 'marca', 'pagina', 'Anatomia do botão e modelos de CTA.', { toc: 'Call to Action (CTA)', nota: true }),
  P(12, 'imagens-regras', 'Direcionamento para imagens', 'marca', 'pagina', 'Listas "fazer" e "não fazer" para fotografia.', { toc: 'Direcionamento para imagens' }),
  P(13, 'imagens-exemplos', 'Direcionamento para imagens (exemplos)', 'marca', 'pagina', 'Exemplos certo/errado de recorte e texto sobre foto.', { toc: 'Direcionamento para imagens', nota: true }),
  P(14, 'banners', 'Banners', 'banners', 'divisor', 'Abertura do capítulo de peças de mídia social.'),
  P(15, 'banners-margens', 'Margens', 'banners', 'pagina', 'Margens seguras de feed, story e Facebook.', { toc: 'Margens', nota: true }),
  P(16, 'banners-logo', 'Logotipo principal', 'banners', 'pagina', 'Posição e tamanho do logo nos três formatos.', { toc: 'Logotipo principal', nota: true }),
  P(17, 'banners-logo-reduzido', 'Logotipo reduzido', 'banners', 'pagina', 'Uso do símbolo quando falta espaço.', { toc: 'Logotipo reduzido', nota: true }),
  P(18, 'banners-tipo-ig-feed', 'Tipografia | Instagram - Feed', 'banners', 'pagina', 'Escala tipográfica do feed 1080×1080.', { toc: 'Tipografia por formato', nota: true }),
  P(19, 'banners-tipo-ig-story', 'Tipografia | Instagram - Story', 'banners', 'pagina', 'Escala tipográfica do story 1080×1920.', { toc: 'Tipografia por formato', nota: true }),
  P(20, 'banners-tipo-fb-feed', 'Tipografia | Facebook - Feed', 'banners', 'pagina', 'Escala tipográfica do feed do Facebook.', { toc: 'Tipografia por formato', nota: true }),
  P(21, 'banners-exemplos', 'Exemplos de banners', 'banners', 'subdivisor', 'Abertura dos exemplos de banners.', { toc: 'Exemplos de composição' }),
  P(22, 'banners-exemplos-formatos', 'Exemplos', 'banners', 'pagina', 'Os três formatos lado a lado.', { toc: 'Exemplos de composição' }),
  P(23, 'criativo-01', 'Exemplos | Criativo 01', 'banners', 'pagina', 'Feed Instagram em fundo escuro, com descrição.', { toc: 'Exemplos de composição' }),
  P(24, 'criativo-02', 'Exemplos | Criativo 02', 'banners', 'pagina', 'Story em versão clara, com descrição.', { toc: 'Exemplos de composição' }),
  P(25, 'criativo-03', 'Exemplos | Criativo 03', 'banners', 'pagina', 'Feed Facebook em duas colunas, com descrição.', { toc: 'Exemplos de composição' }),
  P(26, 'lp', 'Landing pages', 'lp', 'divisor', 'Abertura do capítulo de landing pages.'),
  P(27, 'lp-logo', 'Logotipo', 'lp', 'pagina', 'Logo no cabeçalho e rodapé da LP.', { toc: 'Logotipo', nota: true }),
  P(28, 'lp-margens', 'Margens', 'lp', 'pagina', 'Grid e margens desktop/mobile.', { toc: 'Margens', nota: true }),
  P(29, 'lp-tipo-desktop-1', 'Tipografia | Desktop', 'lp', 'pagina', 'Escala H1–H3 no desktop.', { toc: 'Tipografia | Desktop' }),
  P(30, 'lp-tipo-desktop-2', 'Tipografia | Desktop (2)', 'lp', 'pagina', 'Corpo, legendas e botões no desktop.', { toc: 'Tipografia | Desktop', nota: true }),
  P(31, 'lp-tipo-mobile-1', 'Tipografia | Mobile', 'lp', 'pagina', 'Escala H1–H3 no mobile.', { toc: 'Tipografia | Mobile' }),
  P(32, 'lp-tipo-mobile-2', 'Tipografia | Mobile (2)', 'lp', 'pagina', 'Corpo, legendas e botões no mobile.', { toc: 'Tipografia | Mobile', nota: true }),
  P(33, 'lp-tipo-auxiliar', 'Tipografia auxiliar', 'lp', 'pagina', 'Fontes de sistema para e-mail e Office.', { toc: 'Tipografia auxiliar', nota: true }),
  P(34, 'lp-equivalencia-pesos', 'Equivalência de pesos', 'lp', 'pagina', 'Tabela de pesos entre fonte principal e auxiliar.', { toc: 'Tipografia auxiliar', nota: true }),
  P(35, 'lp-cta', 'Call to Action (CTA)', 'lp', 'pagina', 'Botões e estados na LP.', { toc: 'Call to Action (CTA)' }),
  P(36, 'lp-exemplo', 'Exemplo de landing page', 'lp', 'subdivisor', 'Abertura do exemplo de LP.', { toc: 'Exemplo de composição' }),
  P(37, 'lp-exemplo-topo', 'Exemplo de landing page | Topo', 'lp', 'pagina', 'Mockup do topo da LP (hero, cards).', { toc: 'Exemplo de composição', nota: true }),
  P(38, 'lp-exemplo-continuacao', 'Exemplo de landing page | Continuação', 'lp', 'pagina', 'Mockup da prova social, conversão e rodapé.', { toc: 'Exemplo de composição', nota: true }),
];

const PAGE_BY_ID = new Map(TEMPLATE_PAGES.map((p) => [p.id, p]));
export const templatePage = (id: string) => PAGE_BY_ID.get(id);

/* ─── the plan ─── */

export type CustomLayout = 'cards' | 'persona' | 'tabela' | 'fazer_nao_fazer' | 'checklist' | 'texto';

export interface CustomItem {
  titulo: string;
  texto: string;
  lista: string[];
}

export interface CustomPage {
  id: string;
  titulo: string;
  /** Template page id, another custom page id, or "estrategia" (strategy chapter). */
  depoisDe: string;
  layout: CustomLayout;
  intro: string;
  itens: CustomItem[];
  /** Column headers for "tabela". */
  colunas: string[];
  fazer: string[];
  naoFazer: string[];
  nota: string;
}

export interface Diagnostico {
  problema: string;
  persona: string;
  atributos: string[];
  naoTransmitir: string[];
  restricoes: string[];
  tomDeVoz: string;
}

export type CoverageStatus = 'aplicado' | 'parcial' | 'sem_acao';

export interface Cobertura {
  pergunta: string;
  resposta: string;
  /** How the answer shaped the manual (or why it didn't). */
  aplicacao: string;
  paginas: string[];
  status: CoverageStatus;
}

export interface ManualPlan {
  diagnostico: Diagnostico;
  estrategia: { incluir: boolean; titulo: string; texto: string };
  /** Only pages the plan decided to REMOVE need to be here; the rest stay. */
  paginas: { id: string; incluir: boolean; motivo: string }[];
  /** Rewritten "Orientações de uso" per template page. */
  notas: { id: string; texto: string }[];
  /** Rewritten chapter openings (divider pages). */
  divisores: { id: string; texto: string }[];
  extras: CustomPage[];
  cobertura: Cobertura[];
  pendencias: string[];
}

export const LAYOUT_LABELS: Record<CustomLayout, string> = {
  cards: 'Cartões',
  persona: 'Persona',
  tabela: 'Tabela',
  fazer_nao_fazer: 'Fazer / não fazer',
  checklist: 'Checklist',
  texto: 'Texto',
};

/* ─── normalizing the AI's plan ─── */

const LIMITS = {
  extras: 8, notas: 20, itens: 6, lista: 5, fazer: 6,
  titulo: 60, intro: 320, itemTitulo: 70, itemTexto: 260, listaItem: 120, nota: 520, divisor: 420,
};

/** Cut at a word boundary. */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(' ');
  return `${(i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const str = (v: unknown, max: number) => (typeof v === 'string' ? clip(v, max) : '');
const strList = (v: unknown, n: number, max: number) =>
  (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, n).map((x: string) => clip(x, max)) : []);
const LAYOUTS = Object.keys(LAYOUT_LABELS) as CustomLayout[];

export function emptyPlan(): ManualPlan {
  return {
    diagnostico: { problema: '', persona: '', atributos: [], naoTransmitir: [], restricoes: [], tomDeVoz: '' },
    estrategia: { incluir: false, titulo: 'Estratégia de comunicação', texto: '' },
    paginas: [], notas: [], divisores: [], extras: [], cobertura: [], pendencias: [],
  };
}

export function normalizePlan(input: unknown): ManualPlan {
  const s = (input ?? {}) as Loose;
  const d = s.diagnostico ?? {};
  const plan = emptyPlan();
  plan.diagnostico = {
    problema: str(d.problema, 300),
    persona: str(d.persona, 300),
    atributos: strList(d.atributos, 5, 40),
    naoTransmitir: strList(d.naoTransmitir, 6, 40),
    restricoes: strList(d.restricoes, 6, 160),
    tomDeVoz: str(d.tomDeVoz, 240),
  };

  const ids = new Set<string>();
  const extras: CustomPage[] = [];
  for (const [i, e] of (Array.isArray(s.extras) ? s.extras : []).slice(0, LIMITS.extras).entries()) {
    const titulo = str(e?.titulo, LIMITS.titulo);
    if (!titulo) continue;
    let id = typeof e?.id === 'string' && /^[a-z0-9-]{2,40}$/.test(e.id) && !PAGE_BY_ID.has(e.id) ? e.id : `extra-${i + 1}`;
    while (ids.has(id)) id = `${id}-b`;
    ids.add(id);
    const layout: CustomLayout = LAYOUTS.includes(e?.layout) ? e.layout : 'cards';
    extras.push({
      id, titulo, layout,
      depoisDe: typeof e?.depoisDe === 'string' ? e.depoisDe : 'estrategia',
      intro: str(e?.intro, LIMITS.intro),
      itens: (Array.isArray(e?.itens) ? e.itens : []).slice(0, LIMITS.itens).map((it: Loose) => ({
        titulo: str(it?.titulo, LIMITS.itemTitulo),
        texto: str(it?.texto, LIMITS.itemTexto),
        lista: strList(it?.lista, LIMITS.lista, LIMITS.listaItem),
      })).filter((it: CustomItem) => it.titulo || it.texto || it.lista.length),
      colunas: strList(e?.colunas, 3, 30),
      fazer: strList(e?.fazer, LIMITS.fazer, LIMITS.listaItem),
      naoFazer: strList(e?.naoFazer, LIMITS.fazer, LIMITS.listaItem),
      nota: str(e?.nota, LIMITS.nota),
    });
  }
  // anchors must exist; anything else goes to the strategy chapter
  for (const e of extras) {
    if (e.depoisDe !== 'estrategia' && !PAGE_BY_ID.has(e.depoisDe) && !ids.has(e.depoisDe)) e.depoisDe = 'estrategia';
    if (e.depoisDe === e.id) e.depoisDe = 'estrategia';
  }
  plan.extras = extras;

  const est = s.estrategia ?? {};
  plan.estrategia = {
    incluir: est.incluir !== false && (extras.some((e) => e.depoisDe === 'estrategia') || !!plan.diagnostico.problema),
    titulo: str(est.titulo, 50) || 'Estratégia de comunicação',
    texto: str(est.texto, LIMITS.divisor),
  };

  plan.paginas = (Array.isArray(s.paginas) ? s.paginas : [])
    .filter((p: Loose) => typeof p?.id === 'string' && PAGE_BY_ID.has(p.id))
    .map((p: Loose) => ({ id: p.id, incluir: PAGE_BY_ID.get(p.id)!.essencial ? true : p.incluir !== false, motivo: str(p.motivo, 200) }));
  plan.notas = (Array.isArray(s.notas) ? s.notas : [])
    .filter((n: Loose) => typeof n?.id === 'string' && PAGE_BY_ID.get(n.id)?.nota && typeof n.texto === 'string' && n.texto.trim())
    .slice(0, LIMITS.notas)
    .map((n: Loose) => ({ id: n.id, texto: clip(n.texto, LIMITS.nota) }));
  plan.divisores = (Array.isArray(s.divisores) ? s.divisores : [])
    .filter((n: Loose) => typeof n?.id === 'string' && /divisor/.test(PAGE_BY_ID.get(n.id)?.tipo ?? '') && typeof n.texto === 'string' && n.texto.trim())
    .map((n: Loose) => ({ id: n.id, texto: clip(n.texto, LIMITS.divisor) }));
  plan.cobertura = (Array.isArray(s.cobertura) ? s.cobertura : []).slice(0, 40).map((c: Loose) => ({
    pergunta: str(c?.pergunta, 300),
    resposta: str(c?.resposta, 400),
    aplicacao: str(c?.aplicacao, 300),
    paginas: strList(c?.paginas, 8, 60),
    status: (['aplicado', 'parcial', 'sem_acao'] as const).includes(c?.status) ? c.status : 'parcial',
  })).filter((c: Cobertura) => c.pergunta);
  plan.pendencias = strList(s.pendencias, 10, 200);
  return plan;
}

/* ─── the page list the plan produces (also drives the UI) ─── */

export interface OutlineEntry {
  key: string;
  titulo: string;
  tipo: PageKind | 'extra' | 'contexto';
  capitulo: ChapterId | null;
  /** Template page or custom page behind this entry. */
  template?: TemplatePage;
  extra?: CustomPage;
  numero: number;
  toc?: string;
}

const CHAPTER_ORDER: ChapterId[] = ['estrategia', 'marca', 'banners', 'lp'];

export function isIncluded(plan: ManualPlan | null, id: string): boolean {
  const t = PAGE_BY_ID.get(id);
  if (!t) return false;
  if (t.essencial || !plan) return true;
  return plan.paginas.find((p) => p.id === id)?.incluir ?? true;
}

/** Final order of pages: cover, TOC, strategy chapter, then the template with the extras slotted in. */
export function outline(plan: ManualPlan | null): OutlineEntry[] {
  const out: Omit<OutlineEntry, 'numero'>[] = [];
  const extras = plan?.extras ?? [];
  const placed = new Set<string>();
  const pushExtrasAfter = (anchor: string, capitulo: ChapterId | null) => {
    for (const e of extras) {
      if (e.depoisDe !== anchor || placed.has(e.id)) continue;
      placed.add(e.id);
      out.push({ key: e.id, titulo: e.titulo, tipo: 'extra', capitulo, extra: e, toc: e.titulo });
      pushExtrasAfter(e.id, capitulo);
    }
  };

  const byChapter = (c: ChapterId | null) => TEMPLATE_PAGES.filter((p) => p.capitulo === c);
  for (const p of byChapter(null)) out.push({ key: p.id, titulo: p.titulo, tipo: p.tipo, capitulo: null, template: p });

  for (const c of CHAPTER_ORDER) {
    const start = out.length;
    if (c === 'estrategia') {
      if (!plan?.estrategia.incluir) continue;
      out.push({ key: 'estrategia', titulo: plan.estrategia.titulo, tipo: 'divisor', capitulo: c });
      if (hasDiagnostico(plan)) out.push({ key: 'contexto', titulo: 'Contexto do briefing', tipo: 'contexto', capitulo: c, toc: 'Contexto do briefing' });
      pushExtrasAfter('estrategia', c);
      pushExtrasAfter('contexto', c);
      continue;
    }
    const pages = byChapter(c);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.tipo === 'subdivisor') {
        // a sub-divider stays only if something of its group stays
        const group: TemplatePage[] = [];
        for (let j = i + 1; j < pages.length && pages[j].toc === p.toc && pages[j].tipo === 'pagina'; j++) group.push(pages[j]);
        const groupAlive = group.some((g) => isIncluded(plan, g.id)) || extras.some((e) => group.some((g) => e.depoisDe === g.id));
        if (!isIncluded(plan, p.id) || !groupAlive) { pushExtrasAfter(p.id, c); continue; }
      } else if (!isIncluded(plan, p.id)) {
        pushExtrasAfter(p.id, c); // extras anchored to a removed page keep their place
        continue;
      }
      out.push({ key: p.id, titulo: p.titulo, tipo: p.tipo, capitulo: c, template: p, toc: p.toc });
      pushExtrasAfter(p.id, c);
    }
    // the chapter opening goes when nothing but it is left
    const chapter = out.slice(start);
    if (chapter.length && chapter.every((e) => e.tipo === 'divisor')) out.splice(start);
  }
  // extras whose anchor never showed up
  for (const e of extras) if (!placed.has(e.id)) {
    placed.add(e.id);
    out.push({ key: e.id, titulo: e.titulo, tipo: 'extra', capitulo: null, extra: e, toc: e.titulo });
  }
  return out.map((e, i) => ({ ...e, numero: i + 1 }));
}

export function hasDiagnostico(plan: ManualPlan): boolean {
  const d = plan.diagnostico;
  return !!(d.problema || d.persona || d.atributos.length || d.naoTransmitir.length || d.restricoes.length);
}

/* ─── HTML ─── */

const MARKER = /<!-- ═════════ (\d{2}) · [^\n]*? ═════════ -->/g;

export interface SplitTemplate {
  head: string;
  pages: Map<string, string>;
  tail: string;
}

/** Cut the template (or a filled manual) into its 38 pages. */
export function splitTemplate(html: string): SplitTemplate {
  const marks = [...html.matchAll(MARKER)];
  if (!marks.length) throw new Error('Template sem marcadores de página');
  const head = html.slice(0, marks[0].index);
  const last = marks[marks.length - 1].index!;
  const scriptAt = html.indexOf('<script>', last);
  const deckEnd = html.lastIndexOf('</div>', scriptAt < 0 ? html.length : scriptAt);
  const pages = new Map<string, string>();
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index! : deckEnd;
    const t = TEMPLATE_PAGES[Number(m[1]) - 1];
    if (t) pages.set(t.id, html.slice(m.index, end).trimEnd() + '\n\n');
  });
  return { head, pages, tail: html.slice(deckEnd) };
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escaped text with **bold** and line breaks as paragraphs. */
const rich = (s: string) => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const paras = (s: string) => s.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${rich(p)}</p>`).join('\n      ');

const FOOT = (n: number) => `  <div class="foot">
    <div class="by">Material desenvolvido por:<img src="assets/agencia-mestre.png" alt=""></div>
    <div class="pg"><b>${String(n).padStart(2, '0')}</b><div class="bars"><i style="background:var(--accent-700)"></i><i style="background:var(--brand-600)"></i><i style="background:var(--brand-900)"></i></div></div>
  </div>`;

const NOTE = (texto: string) => texto ? `
    <div class="note">
      <svg class="bulb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3z"/></svg>
      <div class="label">Orientações de uso:</div>
      ${paras(texto)}
    </div>` : '';

const ul = (items: string[], cls = 'dd do') => items.length ? `<ul class="${cls}">${items.map((i) => `<li>${rich(i)}</li>`).join('')}</ul>` : '';

function renderLayout(e: CustomPage): string {
  const intro = e.intro ? `<p class="x-intro">${rich(e.intro)}</p>` : '';
  const n = Math.max(1, e.itens.length);
  switch (e.layout) {
    case 'persona':
      return `${intro}<div class="x-grid" style="--n:${Math.min(3, n)}">${e.itens.map((it) => `
        <div class="x-persona"><div class="x-persona-h">${rich(it.titulo)}</div><div class="x-persona-b">
          ${it.texto ? `<p>${rich(it.texto)}</p>` : ''}
          ${it.lista.length ? `<div class="x-label">Precisa ver no criativo</div>${ul(it.lista, 'x-list')}` : ''}
        </div></div>`).join('')}</div>`;
    case 'tabela': {
      const cols = e.colunas.length >= 2 ? e.colunas : ['Tema', 'Diretriz'];
      const third = cols.length >= 3;
      return `${intro}<table class="spec x-table"><thead><tr>${cols.slice(0, third ? 3 : 2).map((c) => `<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${e.itens.map((it) =>
        `<tr><td>${rich(it.titulo)}</td><td>${rich(it.texto)}</td>${third ? `<td>${rich(it.lista.join(' · '))}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    }
    case 'fazer_nao_fazer':
      return `${intro}<div class="cols">
        <div><div class="band do">Fazer</div>${ul(e.fazer, 'dd do')}</div>
        <div><div class="band dont">Não fazer</div>${ul(e.naoFazer, 'dd dont')}</div>
      </div>`;
    case 'checklist':
      return `${intro}<div class="x-check">${e.itens.map((it) => `
        <div class="x-check-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>
          <div><b>${rich(it.titulo)}</b>${it.texto ? `<span>${rich(it.texto)}</span>` : ''}</div></div>`).join('')}</div>`;
    case 'texto':
      return `${intro}<div class="x-text" style="--n:${Math.min(2, n)}">${e.itens.map((it) => `
        <div>${it.titulo ? `<h3>${rich(it.titulo)}</h3>` : ''}${it.texto ? `<p>${rich(it.texto)}</p>` : ''}${ul(it.lista, 'x-list')}</div>`).join('')}</div>`;
    case 'cards':
    default:
      return `${intro}<div class="x-grid" style="--n:${Math.min(4, n)}">${e.itens.map((it, i) => `
        <div class="x-card${i === 0 ? ' first' : ''}"><h3>${rich(it.titulo)}</h3>${it.texto ? `<p>${rich(it.texto)}</p>` : ''}${ul(it.lista, 'x-list')}</div>`).join('')}</div>`;
  }
}

function customPageHtml(e: CustomPage, n: number): string {
  return `<!-- ═════════ ${String(n).padStart(2, '0')} · ${escHtml(e.titulo.toUpperCase())} (sob medida) ═════════ -->
<div class="frame"><div class="slide x-custom">
  <div class="head"><h2>${escHtml(e.titulo)}</h2></div>
  <div class="body">
    <div class="x-fit"><div class="x-in">${renderLayout(e)}
    </div></div>${NOTE(e.nota)}
  </div>
${FOOT(n)}
</div></div>

`;
}

function contextoHtml(plan: ManualPlan, n: number): string {
  const d = plan.diagnostico;
  const chips = (items: string[], cls: string) => `<div class="x-chips">${items.map((i) => `<span class="${cls}">${escHtml(i)}</span>`).join('')}</div>`;
  return `<!-- ═════════ ${String(n).padStart(2, '0')} · CONTEXTO DO BRIEFING (sob medida) ═════════ -->
<div class="frame"><div class="slide x-custom">
  <div class="head"><h2>Contexto do briefing</h2></div>
  <div class="body">
    <div class="x-fit"><div class="x-in"><div class="x-ctx">
      <div class="x-ctx-l">
        ${d.problema ? `<div class="x-quote"><div class="x-label">O problema que resolvemos</div><p>${rich(d.problema)}</p></div>` : ''}
        ${d.tomDeVoz ? `<div class="x-block"><div class="x-label">Tom de voz</div><p>${rich(d.tomDeVoz)}</p></div>` : ''}
      </div>
      <div class="x-ctx-r">
        ${d.persona ? `<div class="x-block"><div class="x-label">Quem precisamos impactar</div><p>${rich(d.persona)}</p></div>` : ''}
        ${d.atributos.length ? `<div class="x-block"><div class="x-label">Atributos da linguagem visual</div>${chips(d.atributos, 'x-chip')}</div>` : ''}
        ${d.naoTransmitir.length ? `<div class="x-block"><div class="x-label">A marca não quer parecer</div>${chips(d.naoTransmitir, 'x-chip no')}</div>` : ''}
        ${d.restricoes.length ? `<div class="x-block"><div class="x-label">Restrições</div>${ul(d.restricoes, 'dd dont x-flat')}</div>` : ''}
      </div>
    </div></div></div>
  </div>
${FOOT(n)}
</div></div>

`;
}

function strategyDividerHtml(plan: ManualPlan, marca: string, n: number): string {
  const texto = plan.estrategia.texto ||
    `Antes das regras de aplicação, o contexto: o que o briefing da ${marca} nos contou sobre o público, o problema que a marca resolve e o que a comunicação precisa — e não pode — transmitir. Tudo o que vem depois parte daqui.`;
  return `<!-- ═════════ ${String(n).padStart(2, '0')} · DIVISOR ESTRATÉGIA (sob medida) ═════════ -->
<div class="frame"><div class="slide divider">
  <svg class="glyph" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
    <circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="9"/><path d="M50 4v14M50 82v14M4 50h14M82 50h14"/>
  </svg>
  <div class="body">
    <h2>${escHtml(plan.estrategia.titulo)}</h2>
    <p>${rich(texto)}</p>
  </div>
${FOOT(n)}
</div></div>

`;
}

function tocHtml(entries: OutlineEntry[]): string {
  interface Sec { titulo: string; numero: number; itens: { label: string; numero: number }[] }
  const secs: Sec[] = [];
  let cur: Sec | null = null;
  let lastChapter: ChapterId | null = null;
  for (const e of entries) {
    if (!e.capitulo) continue;
    if (e.capitulo !== lastChapter) {
      lastChapter = e.capitulo;
      cur = e.tipo === 'divisor'
        ? { titulo: e.titulo, numero: e.numero, itens: [] }
        : { titulo: chapterTitle(e.capitulo), numero: e.numero, itens: [] };
      secs.push(cur);
      if (e.tipo === 'divisor') continue;
    }
    const label = e.toc ?? e.titulo;
    if (cur && cur.itens[cur.itens.length - 1]?.label !== label) cur.itens.push({ label, numero: e.numero });
  }
  const weight = (s: Sec) => s.itens.length + 2;
  const total = secs.reduce((a, s) => a + weight(s), 0);
  const cols: Sec[][] = [[], []];
  let acc = 0;
  for (const s of secs) {
    (acc < total / 2 || !cols[0].length ? cols[0] : cols[1]).push(s);
    acc += weight(s);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const sec = (s: Sec) => `
        <section>
          <h3><span>${escHtml(s.titulo)}</span><span>${pad(s.numero)}</span></h3>
          <ul>
${s.itens.map((i) => `            <li><span>${escHtml(i.label)}</span><span>${pad(i.numero)}</span></li>`).join('\n')}
          </ul>
        </section>`;
  return `<div class="x-fit" data-nogrow><div class="x-in"><div class="toc">
      <div>${cols[0].map(sec).join('')}
      </div>
      <div>${cols[1].map(sec).join('')}
      </div>
    </div></div></div>`;
}

function chapterTitle(c: ChapterId): string {
  return { estrategia: 'Estratégia de comunicação', marca: 'Elementos da marca', banners: 'Banners', lp: 'Landing pages' }[c];
}

export const EXTRA_CSS = `
/* ═══ PÁGINAS SOB MEDIDA (geradas a partir do briefing) ═══════════ */
.x-fit{flex:1;min-height:0;overflow:hidden}
.x-in{transform-origin:top left}
.x-intro{font-size:23px;line-height:1.55;color:var(--ink-soft);max-width:70ch;margin-bottom:32px}
.x-intro b,.x-card b,.x-text b{color:var(--ink)}
.x-label{font-family:var(--font-alt);font-weight:700;font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--brand-600);margin-bottom:12px}
.x-grid{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:28px;align-items:stretch}
.x-card{border:1px solid var(--rule);border-top:6px solid var(--brand-600);padding:34px 32px;background:#fff}
.x-card.first{border-top-color:var(--accent-700)}
.x-card h3{font-family:var(--font-head);font-weight:700;font-size:28px;line-height:1.2;color:var(--brand-900);margin-bottom:14px}
.x-card p{font-size:19px;line-height:1.55;color:var(--ink-soft)}
.x-list{margin-top:16px}
.x-list li{list-style:none;display:flex;gap:12px;font-size:18px;line-height:1.5;color:var(--ink-soft);margin-bottom:10px}
.x-list li::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;margin-top:9px;background:var(--brand-600)}
.x-persona{border:1px solid var(--rule);background:#fff;display:flex;flex-direction:column}
.x-persona-h{background:var(--brand-900);color:#fff;font-family:var(--font-head);font-weight:700;font-size:26px;padding:26px 30px;line-height:1.25}
.x-persona-b{padding:28px 30px}
.x-persona-b p{font-size:19px;line-height:1.55;color:var(--ink-soft);margin-bottom:20px}
.x-table td{font-size:18px;line-height:1.5;vertical-align:top}
.x-check{display:grid;grid-template-columns:1fr 1fr;gap:22px 48px}
.x-check-i{display:flex;gap:18px;align-items:flex-start;font-size:19px;line-height:1.5;color:var(--ink-soft)}
.x-check-i svg{flex:none;width:32px;height:32px;color:var(--brand-600);margin-top:1px}
.x-check-i b{display:block;color:var(--ink);font-size:21px;margin-bottom:2px}
.x-text{display:grid;grid-template-columns:repeat(var(--n,2),1fr);gap:30px 60px}
.x-text h3{font-family:var(--font-head);font-weight:700;font-size:27px;color:var(--brand-900);margin-bottom:12px}
.x-text p{font-size:20px;line-height:1.6;color:var(--ink-soft)}
.x-ctx{display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:start}
.x-ctx-l{display:flex;flex-direction:column;gap:34px}
.x-ctx-r{display:flex;flex-direction:column;gap:30px}
.x-quote{background:var(--brand-900);color:#fff;padding:46px 50px;border-left:10px solid var(--accent-700)}
.x-quote .x-label{color:var(--brand-200)}
.x-quote p{font-family:var(--font-head);font-weight:700;font-size:34px;line-height:1.3}
.x-block p{font-size:20px;line-height:1.55;color:var(--ink-soft)}
.x-chips{display:flex;flex-wrap:wrap;gap:12px}
.x-chip{font-weight:600;font-size:19px;padding:10px 20px;border-radius:999px;background:var(--brand-050);color:var(--brand-900);border:2px solid var(--brand-600)}
.x-chip.no{background:#fff;color:var(--ink-soft);border-color:var(--accent-700);text-decoration:line-through;text-decoration-color:var(--accent-700)}
.dd.x-flat{border:none;padding:0}
`;

/**
 * Fits each made-to-measure page to the slide once fonts are ready: long text
 * shrinks (down to 62%), short text grows (up to 125%) so a page with three
 * items doesn't look empty. Width compensates so lines still span the slide.
 */
const FIT_SCRIPT = `<script id="manual-fit">
(function(){
  function fitAll(){
    document.querySelectorAll('.x-fit').forEach(function(box){
      var inner=box.firstElementChild; if(!inner) return;
      inner.style.transform=''; inner.style.width='';
      var avail=box.clientHeight, need=inner.scrollHeight, k=1;
      if(need>avail+1) k=Math.max(.62,avail/need);
      else if(need<avail*.55 && !box.hasAttribute('data-nogrow')) k=Math.min(1.25,(avail*.8)/need);
      if(k!==1){inner.style.transform='scale('+k+')';inner.style.width=(100/k)+'%';}
      // growing narrows the width, which can re-wrap text taller: back off if it no longer fits
      if(k>1 && inner.scrollHeight*k>avail){k=Math.max(1,avail/inner.scrollHeight*.98);inner.style.transform='scale('+k+')';inner.style.width=(100/k)+'%';}
    });
  }
  fitAll();
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitAll);
  addEventListener('load', fitAll);
})();
</script>`;

export interface PlanLogEntry { ok: boolean; label: string }

/** Apply the plan to a (filled) manual: rewrite notes, drop/add pages, renumber and rebuild the TOC. */
export function applyPlan(html: string, plan: ManualPlan, marca: string): { html: string; log: PlanLogEntry[]; pageCount: number } {
  const log: PlanLogEntry[] = [];
  const { head, pages, tail } = splitTemplate(html);
  log.push({ ok: pages.size === TEMPLATE_PAGES.length, label: `${pages.size}/${TEMPLATE_PAGES.length} páginas do template reconhecidas` });

  for (const n of plan.notas) {
    const src = pages.get(n.id);
    if (!src) continue;
    const re = /(<div class="label">Orientações de uso:<\/div>)[\s\S]*?(<\/div>\s*<\/div>\s*<div class="foot">)/;
    const next = src.replace(re, (_m, a: string, b: string) => `${a}\n      ${paras(n.texto)}\n    ${b}`);
    log.push({ ok: next !== src, label: `orientação reescrita: ${templatePage(n.id)?.titulo ?? n.id}` });
    pages.set(n.id, next);
  }
  for (const d of plan.divisores) {
    const src = pages.get(d.id);
    if (!src) continue;
    const next = src.replace(/(<div class="body">\s*<h2>[^<]*<\/h2>\s*)<p>[\s\S]*?<\/p>/, (_m, a: string) => `${a}<p>${rich(d.texto)}</p>`);
    log.push({ ok: next !== src, label: `abertura reescrita: ${templatePage(d.id)?.titulo ?? d.id}` });
    pages.set(d.id, next);
  }

  const entries = outline(plan);
  const pad = (n: number) => String(n).padStart(2, '0');
  const body = entries.map((e) => {
    if (e.tipo === 'extra' && e.extra) return customPageHtml(e.extra, e.numero);
    if (e.tipo === 'contexto') return contextoHtml(plan, e.numero);
    if (e.key === 'estrategia') return strategyDividerHtml(plan, marca, e.numero);
    let src = pages.get(e.key) ?? '';
    src = src.replace(/<!-- ═════════ \d{2} · /, `<!-- ═════════ ${pad(e.numero)} · `);
    src = src.replace(/(<div class="pg"><b>)\d+(<\/b>)/, `$1${pad(e.numero)}$2`);
    if (e.key === 'sumario') {
      const before = src;
      src = src.replace(/<div class="toc">[\s\S]*<\/div>(\s*<\/div>\s*<div class="foot">)/, (_m, end: string) => `${tocHtml(entries)}${end}`);
      log.push({ ok: src !== before, label: 'sumário refeito com a estrutura final' });
    }
    return src;
  }).join('');

  const removed = TEMPLATE_PAGES.filter((p) => !entries.some((e) => e.key === p.id)).length;
  const added = entries.filter((e) => e.tipo === 'extra' || e.tipo === 'contexto' || e.key === 'estrategia').length;
  log.push({ ok: true, label: `${entries.length} páginas: ${added} sob medida, ${removed} do padrão removida(s)` });

  const outHead = head.replace('</head>', `<style id="manual-extra">${EXTRA_CSS}</style>\n</head>`);
  const outTail = tail.replace('</body>', `${FIT_SCRIPT}\n</body>`);
  return { html: outHead + body + outTail, log, pageCount: entries.length };
}
