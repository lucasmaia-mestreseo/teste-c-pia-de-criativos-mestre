/**
 * Criação de KVs — orchestration between the materials the designer drops in,
 * the AI analysis and the assets the manual template needs.
 */
import {
  cropFraction, dominantColors, fileToDataUrl, forAI, imageToCanvas, inkBox, lightInkShare,
  loadImage, monoVariant, recolorSvg, removeFlatBackground, svgDataUrl, traceToSvg, transparencyShare, trimToInk, type Box,
} from './imageTools';
import { fontFamilyOf, readPdf } from './pdfTools';
import type { ManualAssets, ManualSpec } from './spec';
import { buildTokens } from './tokens';

export type ImageRole = 'auto' | 'logo' | 'logo_tagline' | 'simbolo' | 'foto' | 'peca';

export interface ImageMaterial {
  id: string;
  kind: 'image';
  name: string;
  canvas: HTMLCanvasElement;
  thumb: string;
  role: ImageRole;
}
export interface PdfMaterial {
  id: string;
  kind: 'pdf';
  name: string;
  pageCount: number;
  text: string;
  fonts: string[];
  pages: { number: number; canvas: HTMLCanvasElement; thumb: string }[];
}
export interface TextMaterial { id: string; kind: 'text'; name: string; text: string }
export type Material = ImageMaterial | PdfMaterial | TextMaterial;

export interface ImageInsight {
  id: string;
  tipo: 'logo' | 'logo_tagline' | 'simbolo' | 'foto' | 'peca' | 'pagina' | 'outro';
  foco?: { x: number; y: number };
  simboloBox?: Box;
  fotos?: Box[];
}

/** A photo candidate for foto-01..03. */
export interface PhotoCandidate {
  id: string;
  label: string;
  url: string; // JPEG data URL
  foco: { x: number; y: number };
}

let seq = 0;
const nextId = (p: string) => `${p}${++seq}`;

const thumbOf = (c: HTMLCanvasElement) => forAI(c, 360);

/* ─── loading materials ─── */

export async function loadMaterial(file: File, onProgress?: (msg: string) => void): Promise<Material> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    const data = await file.arrayBuffer();
    const pdf = await readPdf(data, { onProgress });
    return {
      id: nextId('pdf'),
      kind: 'pdf',
      name,
      pageCount: pdf.pageCount,
      text: pdf.text,
      fonts: pdf.fonts,
      pages: pdf.pages.map((p) => ({ number: p.number, canvas: p.canvas, thumb: thumbOf(p.canvas) })),
    };
  }
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/.test(lower)) {
    const url = await fileToDataUrl(file);
    const img = await loadImage(url);
    const isSvg = file.type === 'image/svg+xml' || lower.endsWith('.svg');
    // SVGs are rasterized big so the logo pipeline keeps crisp edges
    const canvas = imageToCanvas(img, 1800, isSvg ? 1600 : 0);
    const role: ImageRole = /logo|marca|assinatura/i.test(name) ? 'logo' : /s[ií]mbolo|icone|ícone|symbol|icon/i.test(name) ? 'simbolo' : 'auto';
    return { id: nextId('img'), kind: 'image', name, canvas, thumb: thumbOf(canvas), role };
  }
  if (file.type.startsWith('text/') || /\.(txt|md|csv|json)$/.test(lower)) {
    return { id: nextId('txt'), kind: 'text', name, text: (await file.text()).slice(0, 20000) };
  }
  throw new Error(`Formato não suportado: ${name}. Use PDF, imagem (PNG, JPG, SVG, WEBP) ou texto (TXT, CSV, MD).`);
}

export async function materialFromUrl(url: string, name: string, role: ImageRole): Promise<ImageMaterial> {
  const img = await loadImage(url);
  const canvas = imageToCanvas(img, 1800);
  return { id: nextId('img'), kind: 'image', name, canvas, thumb: thumbOf(canvas), role };
}

/* ─── building the AI request ─── */

export interface AnalyzeRequest {
  notes: string;
  pdfText: string;
  fontsFound: string[];
  paletteCandidates: { hex: string; share: number; source: string }[];
  images: { id: string; label: string; dataUrl: string }[];
}

const MAX_AI_IMAGES = 12;

export function buildAnalyzeRequest(materials: Material[], notes: string): AnalyzeRequest {
  const images: AnalyzeRequest['images'] = [];
  const palette: AnalyzeRequest['paletteCandidates'] = [];
  const texts: string[] = [];
  const fonts = new Set<string>();

  const imgs = materials.filter((m): m is ImageMaterial => m.kind === 'image');
  // logos first: they carry the palette
  const ordered = [...imgs].sort((a, b) => rank(a.role) - rank(b.role));
  for (const m of ordered) {
    if (images.length >= MAX_AI_IMAGES) break;
    images.push({ id: m.id, label: `${m.name}${m.role !== 'auto' ? ` — marcado como ${m.role}` : ''}`, dataUrl: forAI(m.canvas, 900) });
    const src = m.role === 'logo' || m.role === 'simbolo' || m.role === 'logo_tagline' ? prepareLogo(m.canvas) : m.canvas;
    for (const c of dominantColors(src, 6)) palette.push({ hex: c.hex, share: c.share, source: `${m.name}${c.neutral ? ', neutro' : ''}` });
  }

  for (const m of materials) {
    if (m.kind === 'pdf') {
      texts.push(`### ${m.name} (${m.pageCount} páginas)\n${m.text}`);
      m.fonts.forEach((f) => fonts.add(f));
      for (const p of m.pages) {
        // brand colors printed on the pages (swatch pages, covers) — skip paper white and text gray
        for (const c of dominantColors(p.canvas, 8)) {
          if (!c.neutral && c.share > 0.015) palette.push({ hex: c.hex, share: c.share * 0.8, source: `${m.name} p.${p.number}` });
        }
        if (images.length >= MAX_AI_IMAGES) continue;
        images.push({ id: `${m.id}-p${p.number}`, label: `${m.name}, página ${p.number}`, dataUrl: forAI(p.canvas, 900) });
      }
    } else if (m.kind === 'text') {
      texts.push(`### ${m.name}\n${m.text}`);
    }
  }

  return {
    notes,
    pdfText: texts.join('\n\n').slice(0, 20000),
    fontsFound: [...fonts],
    paletteCandidates: palette.sort((a, b) => b.share - a.share).slice(0, 24),
    images,
  };
}

function rank(r: ImageRole) {
  return { logo: 0, logo_tagline: 1, simbolo: 2, peca: 3, auto: 4, foto: 5 }[r];
}

/** Families mentioned by the embedded font names (for the UI hint). */
export function fontFamiliesFrom(materials: Material[]): string[] {
  const s = new Set<string>();
  for (const m of materials) if (m.kind === 'pdf') m.fonts.forEach((f) => s.add(fontFamilyOf(f)));
  return [...s].filter(Boolean);
}

/* ─── logos ─── */

/** Background removed (when flat) — before trimming, so AI boxes still map to it. */
export function prepareLogo(c: HTMLCanvasElement): HTMLCanvasElement {
  return transparencyShare(c) > 0.02 ? c : removeFlatBackground(c);
}

export interface LogoSet {
  cor: HTMLCanvasElement;
  tagline?: HTMLCanvasElement;
  simbolo?: HTMLCanvasElement;
  razaoLogo: number;
  razaoSimbolo: number;
  simboloFracao?: number;
  /** The uploaded logo was the negative (white) version. */
  negativo: boolean;
}

export function buildLogoSet(
  logo: ImageMaterial | undefined,
  opts: { tagline?: ImageMaterial; simbolo?: ImageMaterial; simboloBox?: Box; principal: string },
): LogoSet | null {
  if (!logo) return null;
  const full = prepareLogo(logo.canvas);
  let cor = trimToInk(full);
  const negativo = lightInkShare(cor) > 0.6;
  if (negativo) cor = monoVariant(cor, opts.principal, false);

  let simbolo: HTMLCanvasElement | undefined;
  let simboloFracao: number | undefined;
  if (opts.simbolo) {
    simbolo = trimToInk(prepareLogo(opts.simbolo.canvas));
  } else if (opts.simboloBox) {
    const s = trimToInk(cropFraction(full, opts.simboloBox));
    const logoBox = inkBox(full);
    const symBox = inkBox(s);
    if (logoBox && symBox && symBox.w < logoBox.w * 0.95) {
      simbolo = s;
      simboloFracao = +(symBox.w / logoBox.w).toFixed(4);
    }
  }
  if (simbolo && negativo) simbolo = monoVariant(simbolo, opts.principal, false);

  return {
    cor,
    tagline: opts.tagline ? trimToInk(prepareLogo(opts.tagline.canvas)) : undefined,
    simbolo,
    razaoLogo: +(cor.width / cor.height).toFixed(4),
    razaoSimbolo: simbolo ? +(simbolo.width / simbolo.height).toFixed(4) : 1,
    simboloFracao,
    negativo,
  };
}

/** The 10 logo files of the manual, as data URLs (vectorized to SVG when asked). */
export async function renderLogoAssets(
  set: LogoSet,
  spec: ManualSpec,
  vectorizeLogos: boolean,
  onProgress?: (msg: string) => void,
): Promise<Omit<ManualAssets, 'fotos'>> {
  const tk = buildTokens(spec);

  /**
   * One trace per source file; mono versions recolor the traced paths (fast
   * and identical geometry). Any failure falls back to PNG for that file.
   */
  const family = async (c: HTMLCanvasElement | undefined, label: string) => {
    if (!c) return null;
    const png = (hex?: string) => (hex ? monoVariant(c, hex) : c).toDataURL('image/png');
    let svg: string | null = null;
    if (vectorizeLogos) {
      onProgress?.(`Vetorizando ${label}…`);
      try {
        const colors = Math.min(8, Math.max(3, dominantColors(c, 8).length + 1));
        svg = await traceToSvg(c, colors);
      } catch {
        svg = null;
      }
    }
    return {
      cor: svg ? svgDataUrl(svg) : png(),
      mono: (hex: string) => (svg ? svgDataUrl(recolorSvg(svg, hex)) : png(hex)),
    };
  };

  const logo = await family(set.cor, 'o logotipo');
  const tagline = await family(set.tagline, 'o logotipo com slogan');
  const simbolo = await family(set.simbolo, 'o símbolo');
  onProgress?.('Gerando versões monocromáticas…');
  return {
    logoCor: logo?.cor ?? null,
    logoCorTagline: tagline?.cor ?? null,
    logoBranco: logo?.mono('#FFFFFF') ?? null,
    logoBrancoTagline: tagline?.mono('#FFFFFF') ?? null,
    logoNavy: logo?.mono(tk.brand900) ?? null,
    logoApoio: logo?.mono(tk.brand600) ?? null,
    logoPreto: logo?.mono('#111111') ?? null,
    simboloCor: simbolo?.cor ?? null,
    simboloBranco: simbolo?.mono('#FFFFFF') ?? null,
    simboloNavy: simbolo?.mono(tk.brand900) ?? null,
    razaoLogo: set.razaoLogo,
    razaoSimbolo: set.razaoSimbolo,
    simboloFracao: set.simboloFracao,
  };
}

/* ─── photos ─── */

export function photoCandidates(materials: Material[], insights: ImageInsight[]): PhotoCandidate[] {
  const byId = new Map(insights.map((i) => [i.id, i]));
  const out: PhotoCandidate[] = [];
  const toJpeg = (c: HTMLCanvasElement) => forAI(c, 1600);
  for (const m of materials) {
    if (m.kind === 'image') {
      const ins = byId.get(m.id);
      const tipo = m.role !== 'auto' ? m.role : ins?.tipo;
      if (tipo === 'foto') {
        out.push({ id: m.id, label: m.name, url: toJpeg(m.canvas), foco: ins?.foco ?? { x: 0.5, y: 0.4 } });
      }
      for (const [i, box] of (ins?.fotos ?? []).entries()) {
        if (!validBox(box)) continue;
        const c = cropFraction(m.canvas, box);
        if (c.width < 240 || c.height < 180) continue;
        out.push({ id: `${m.id}-f${i}`, label: `${m.name} (recorte ${i + 1})`, url: toJpeg(c), foco: { x: 0.5, y: 0.4 } });
      }
    } else if (m.kind === 'pdf') {
      for (const p of m.pages) {
        const ins = byId.get(`${m.id}-p${p.number}`);
        for (const [i, box] of (ins?.fotos ?? []).entries()) {
          if (!validBox(box)) continue;
          const c = cropFraction(p.canvas, box);
          if (c.width < 240 || c.height < 180) continue;
          out.push({ id: `${m.id}-p${p.number}-f${i}`, label: `${m.name}, p.${p.number} (foto ${i + 1})`, url: toJpeg(c), foco: { x: 0.5, y: 0.4 } });
        }
      }
    }
  }
  return out;
}

function validBox(b: Box | undefined): b is Box {
  if (!b) return false;
  const w = Math.abs(b.x1 - b.x0);
  const h = Math.abs(b.y1 - b.y0);
  return w > 0.12 && h > 0.12 && w <= 1.01 && h <= 1.01;
}

/** Pick the logo/tagline/symbol materials using the user's roles first, then the AI's classification. */
export function pickLogoMaterials(materials: Material[], insights: ImageInsight[]) {
  const imgs = materials.filter((m): m is ImageMaterial => m.kind === 'image');
  const tipo = (m: ImageMaterial) => (m.role !== 'auto' ? m.role : insights.find((i) => i.id === m.id)?.tipo);
  const logo = imgs.find((m) => m.role === 'logo') ?? imgs.find((m) => tipo(m) === 'logo') ?? imgs.find((m) => tipo(m) === 'logo_tagline');
  const tagline = imgs.find((m) => m !== logo && tipo(m) === 'logo_tagline');
  const simbolo = imgs.find((m) => m !== logo && tipo(m) === 'simbolo');
  const simboloBox = logo ? insights.find((i) => i.id === logo.id)?.simboloBox : undefined;
  return { logo, tagline, simbolo, simboloBox };
}
