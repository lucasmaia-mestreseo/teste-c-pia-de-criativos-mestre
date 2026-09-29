import { describe, it, expect } from 'vitest';
import { cmykLabel, contrast, mix, normalizeHex, readableOn, saturation } from '@/kv/color';
import { normalizeSpec, type ManualAssets } from '@/kv/spec';
import { buildTokens, fillTemplate } from '@/kv/fillTemplate';
import { cleanFontName, fontFamilyOf } from '@/kv/pdfTools';
import { googleEquivalent } from '@/kv/fonts';

const svg = (color: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><rect width="30" height="10" fill="${color}"/></svg>`)}`;
const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

function assets(razaoLogo = 4): ManualAssets {
  return {
    logoCor: svg('#0B2A4A'), logoBranco: svg('#fff'), logoNavy: svg('#0B2A4A'), logoApoio: svg('#1B5FA8'), logoPreto: svg('#111'),
    simboloCor: null, simboloBranco: null, simboloNavy: null,
    razaoLogo, razaoSimbolo: 1,
    fotos: [
      { url: jpg, foco: { x: 0.3, y: 0.2 } },
      { url: jpg, foco: { x: 0.75, y: 0.4 } },
      { url: jpg, foco: { x: 0.5, y: 0.1 } },
    ],
  };
}

const spec = normalizeSpec({
  marca: 'Horizonte Engenharia',
  slogan: 'Obra no prazo.',
  headlinePrincipal: 'Galpões que entregam no prazo',
  posicionamento: 'Engenharia industrial sem atraso',
  cores: {
    principal: { hex: '#0B2A4A', nome: 'Azul Horizonte', uso: 'Base' },
    apoio: { hex: '#1B5FA8', nome: 'Azul claro', uso: 'Títulos' },
    acento: { hex: '#F0962E', nome: 'Laranja Obra', uso: 'CTA' },
    paleta: [],
    nota: '',
  },
  tipografia: { primaria: 'Montserrat', secundaria: 'Montserrat', auxiliarPrimaria: 'Arial', auxiliarSecundaria: 'Georgia', nota: '' },
  cta: { institucional: 'conheça', principal: 'peça seu orçamento', secundario: 'saiba mais', material: 'baixe o catálogo', demo: 'fale conosco', solucoes: 'ver obras' },
  imagens: { fazer: ['Canteiro real'], naoFazer: ['Rosto cortado'] },
  criativos: [['Fundo azul'], ['Versão clara'], ['Duas colunas']],
});

describe('color helpers', () => {
  it('computes WCAG contrast and readable text', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    // white on orange fails (the lesson from the hand-made manuals) → dark text
    expect(contrast('#FFFFFF', '#F0962E')).toBeLessThan(4.5);
    expect(readableOn('#F0962E', '#0B2A4A').color).toBe('#0B2A4A');
    expect(readableOn('#0B2A4A').color).toBe('#FFFFFF');
  });

  it('normalizes hex, mixes and labels CMYK', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex('nope')).toBeNull();
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(cmykLabel('#000000')).toBe('CMYK 0/0/0/100');
  });

  it('treats near-white as neutral (HSL saturation used to call #FEFEFF saturated)', () => {
    expect(saturation('#FEFEFF')).toBeLessThan(0.05);
    expect(saturation('#F0962E')).toBeGreaterThan(0.5);
  });
});

describe('spec normalization', () => {
  it('fills every field and clamps lists', () => {
    const s = normalizeSpec({ marca: '  X  ', imagens: { fazer: Array(10).fill('a'), naoFazer: [] } } as never);
    expect(s.marca).toBe('X');
    expect(s.produto).toBe('X');
    expect(s.imagens.fazer).toHaveLength(6);
    expect(s.lp.cards).toHaveLength(3);
    expect(s.lp.menu).toHaveLength(4);
    expect(s.criativos).toHaveLength(3);
  });
});

describe('fillTemplate', () => {
  it('fills the 38 pages with no marker left', () => {
    const r = fillTemplate(spec, assets(), { googleFontsQuery: 'family=Montserrat:wght@400;700' });
    expect(r.remainingMarkers).toEqual([]);
    expect(r.leftoverTerms).toEqual([]);
    expect((r.html.match(/<div class="frame">/g) ?? []).length).toBe(38);
    expect(r.html).toContain('Horizonte Engenharia');
    expect(r.html).toContain('PEÇA SEU ORÇAMENTO');
    expect(r.html).not.toContain('SOLICITE UMA DEMO');
    expect(r.html).toContain('family=Montserrat:wght@400;700');
    expect(r.log.filter((l) => !l.ok)).toEqual([]);
  });

  it('uses dark CTA text when white fails on the accent', () => {
    const r = fillTemplate(spec, assets(), { googleFontsQuery: null });
    expect(r.tokens.ctaInk).not.toBe('#FFFFFF');
    expect(r.html).toContain(`--cta-ink:${r.tokens.ctaInk}`);
    expect(r.html).not.toContain('background:var(--accent-700);color:#fff;');
  });

  it('embeds each image once instead of at every use', () => {
    const r = fillTemplate(spec, assets(), { googleFontsQuery: null });
    const logoUses = (r.html.match(/data-asset="assets\/logo-cor\.svg"/g) ?? []).length;
    expect(logoUses).toBeGreaterThan(5);
    // the logo payload itself appears once, even though tagline/symbol fall back to it
    const b64 = r.html.match(/data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+/g) ?? [];
    expect(b64.length).toBeGreaterThan(0);
    expect(new Set(b64).size).toBe(b64.length);
    // photos go through CSS variables with the focus point applied
    expect(r.html).toContain('var(--a-foto-03-jpg)');
    expect(r.html).toMatch(/object-position:75% 40%/);
  });

  it('shrinks widths for near-square marks so they do not overflow', () => {
    const wide = fillTemplate(spec, assets(4), { googleFontsQuery: null }).html;
    const square = fillTemplate(spec, assets(1.1), { googleFontsQuery: null }).html;
    expect(wide).toContain('data-asset="assets/logo-navy.svg" style="width:460px"');
    expect(square).toContain(`data-asset="assets/logo-navy.svg" style="width:${Math.round((460 * 1.1) / 2.2)}px"`);
  });

  it('derives the brand scale from the three colors', () => {
    const tk = buildTokens(spec);
    expect(tk.brand900).toBe('#0B2A4A');
    expect(tk.brand600).toBe('#1B5FA8');
    expect(tk.accent700).toBe('#F0962E');
    expect(contrast(tk.brand050, '#FFFFFF')).toBeLessThan(1.2); // near-white background
  });
});

describe('fonts', () => {
  it('cleans embedded PDF font names', () => {
    expect(cleanFontName('ABCDEF+Montserrat-SemiBold')).toBe('Montserrat Semi Bold');
    expect(fontFamilyOf('Montserrat Semi Bold')).toBe('Montserrat');
    expect(fontFamilyOf('Helvetica')).toBe('Helvetica');
  });
  it('maps commercial fonts to Google equivalents', () => {
    expect(googleEquivalent('Gotham')).toBe('Montserrat');
    expect(googleEquivalent('Futura PT')).toBe('Jost');
    expect(googleEquivalent('Montserrat')).toBeNull();
  });
});
