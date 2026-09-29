/**
 * Criação de KVs — the data contract of a brand manual.
 *
 * The AI (edge function `kv-analyze`) fills a ManualSpec from the client's
 * materials; the user reviews/edits it on the "Resumo" step; `fillTemplate`
 * turns it into the 38-page Agência Mestre manual. The AI produces DATA, never
 * layout — the layout is the fixed template in manual-template.html.
 */

export interface PaletteColor {
  hex: string;
  nome: string;
  uso: string;
}

export interface ManualSpec {
  marca: string;
  produto: string;
  slogan: string;

  headlinePrincipal: string;
  headlineSecundaria: string;
  headlineTerceira: string;
  /** Becomes the LP hero h1: short (max 2 lines). */
  posicionamento: string;
  textoDeApoio: string;

  cores: {
    principal: PaletteColor;
    apoio: PaletteColor;
    acento: PaletteColor;
    /** Optional darker brand tone; derived from `principal` when empty. */
    profundo?: string;
    /** Full official palette for p.09 (up to 8). Empty → the 4 main chips. */
    paleta: PaletteColor[];
    nota: string;
  };

  tipografia: {
    /** Google Fonts family names. */
    primaria: string;
    secundaria: string;
    /** Web-safe substitutes (email, Office). */
    auxiliarPrimaria: string;
    auxiliarSecundaria: string;
    nota: string;
  };

  cta: {
    institucional: string;
    principal: string;
    secundario: string;
    material: string;
    demo: string;
    solucoes: string;
  };

  lp: {
    subtituloHero: string;
    tituloSecao1: string;
    tituloSecao2: string;
    textoSecao2: string;
    cards: { titulo: string; texto: string }[];
    menu: string[];
    rodapeLinks: string;
  };

  imagens: {
    fazer: string[];
    naoFazer: string[];
  };

  /** 3 lists (creative 01–03), up to 6 bullets each. */
  criativos: string[][];

  resumo: {
    direcaoVisual: string;
    tomDeVoz: string;
    publico: string;
  };

  /** What the AI inferred instead of reading from an official source. */
  inferencias: string[];
  /** Missing materials worth asking the client for. */
  pendencias: string[];
}

export const EMPTY_SPEC: ManualSpec = {
  marca: '',
  produto: '',
  slogan: '',
  headlinePrincipal: '',
  headlineSecundaria: '',
  headlineTerceira: '',
  posicionamento: '',
  textoDeApoio: '',
  cores: {
    principal: { hex: '#1B2752', nome: 'Cor institucional', uso: 'Base da identidade' },
    apoio: { hex: '#3F61AA', nome: 'Cor de apoio', uso: 'Títulos, links, cards' },
    acento: { hex: '#E4572E', nome: 'Acento', uso: 'CTA e destaques' },
    paleta: [],
    nota: '',
  },
  tipografia: { primaria: 'Inter', secundaria: 'Inter', auxiliarPrimaria: 'Arial', auxiliarSecundaria: 'Georgia', nota: '' },
  cta: {
    institucional: 'CONHEÇA',
    principal: 'FALE CONOSCO',
    secundario: 'SAIBA MAIS',
    material: 'BAIXE O MATERIAL',
    demo: 'QUERO CONHECER',
    solucoes: 'CONHEÇA AS SOLUÇÕES',
  },
  lp: {
    subtituloHero: '',
    tituloSecao1: '',
    tituloSecao2: '',
    textoSecao2: '',
    cards: [{ titulo: '', texto: '' }, { titulo: '', texto: '' }, { titulo: '', texto: '' }],
    menu: ['Sobre', 'Serviços', 'Conteúdo', 'Contato'],
    rodapeLinks: '',
  },
  imagens: { fazer: [], naoFazer: [] },
  criativos: [[], [], []],
  resumo: { direcaoVisual: '', tomDeVoz: '', publico: '' },
  inferencias: [],
  pendencias: [],
};

/** Merge a partial/untrusted AI result over the defaults so every field exists. */
export function normalizeSpec(input: Partial<ManualSpec> | null | undefined): ManualSpec {
  const s = (input ?? {}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()).slice(0, max) : []);
  const color = (v: any, d: PaletteColor): PaletteColor => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    hex: typeof v?.hex === 'string' && /^#?[0-9a-f]{3,6}$/i.test(v.hex.trim()) ? (v.hex.startsWith('#') ? v.hex : `#${v.hex}`).toUpperCase() : d.hex,
    nome: str(v?.nome, d.nome) || d.nome,
    uso: str(v?.uso, d.uso) || d.uso,
  });
  const E = EMPTY_SPEC;
  const cards = Array.isArray(s.lp?.cards) ? s.lp.cards : [];
  return {
    marca: str(s.marca),
    produto: str(s.produto) || str(s.marca),
    slogan: str(s.slogan),
    headlinePrincipal: str(s.headlinePrincipal),
    headlineSecundaria: str(s.headlineSecundaria),
    headlineTerceira: str(s.headlineTerceira),
    posicionamento: str(s.posicionamento),
    textoDeApoio: str(s.textoDeApoio),
    cores: {
      principal: color(s.cores?.principal, E.cores.principal),
      apoio: color(s.cores?.apoio, E.cores.apoio),
      acento: color(s.cores?.acento, E.cores.acento),
      profundo: typeof s.cores?.profundo === 'string' && s.cores.profundo ? s.cores.profundo : undefined,
      paleta: Array.isArray(s.cores?.paleta) ? s.cores.paleta.slice(0, 8).map((c: unknown) => color(c, { hex: '#CCCCCC', nome: 'Cor', uso: '' })) : [],
      nota: str(s.cores?.nota),
    },
    tipografia: {
      primaria: str(s.tipografia?.primaria, E.tipografia.primaria) || E.tipografia.primaria,
      secundaria: str(s.tipografia?.secundaria) || str(s.tipografia?.primaria) || E.tipografia.secundaria,
      auxiliarPrimaria: str(s.tipografia?.auxiliarPrimaria) || E.tipografia.auxiliarPrimaria,
      auxiliarSecundaria: str(s.tipografia?.auxiliarSecundaria) || E.tipografia.auxiliarSecundaria,
      nota: str(s.tipografia?.nota),
    },
    cta: {
      institucional: str(s.cta?.institucional) || E.cta.institucional,
      principal: str(s.cta?.principal) || E.cta.principal,
      secundario: str(s.cta?.secundario) || E.cta.secundario,
      material: str(s.cta?.material) || E.cta.material,
      demo: str(s.cta?.demo) || E.cta.demo,
      solucoes: str(s.cta?.solucoes) || E.cta.solucoes,
    },
    lp: {
      subtituloHero: str(s.lp?.subtituloHero),
      tituloSecao1: str(s.lp?.tituloSecao1),
      tituloSecao2: str(s.lp?.tituloSecao2),
      textoSecao2: str(s.lp?.textoSecao2),
      cards: [0, 1, 2].map((i) => ({ titulo: str(cards[i]?.titulo), texto: str(cards[i]?.texto) })),
      menu: (list(s.lp?.menu, 4).length === 4 ? list(s.lp?.menu, 4) : E.lp.menu),
      rodapeLinks: str(s.lp?.rodapeLinks),
    },
    imagens: { fazer: list(s.imagens?.fazer, 6), naoFazer: list(s.imagens?.naoFazer, 6) },
    criativos: [0, 1, 2].map((i) => list(s.criativos?.[i], 6)),
    resumo: {
      direcaoVisual: str(s.resumo?.direcaoVisual),
      tomDeVoz: str(s.resumo?.tomDeVoz),
      publico: str(s.resumo?.publico),
    },
    inferencias: list(s.inferencias, 12),
    pendencias: list(s.pendencias, 12),
  };
}

/** Assets the manual needs, as data URLs (PNG or SVG). */
export interface ManualAssets {
  logoCor: string | null;
  logoCorTagline?: string | null;
  logoBranco: string | null;
  logoBrancoTagline?: string | null;
  logoNavy: string | null;
  logoApoio: string | null;
  logoPreto: string | null;
  simboloCor: string | null;
  simboloBranco: string | null;
  simboloNavy: string | null;
  /** width / height of the logo and symbol (tight bounding box). */
  razaoLogo: number;
  razaoSimbolo: number;
  /** Symbol width / logo width, when the symbol was cropped from the logo (sets the protection area X). */
  simboloFracao?: number;
  fotos: { url: string; foco: { x: number; y: number } }[];
}
