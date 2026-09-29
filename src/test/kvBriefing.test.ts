import { describe, it, expect } from 'vitest';
import template from '@/kv/manual-template.html?raw';
import { briefingFromText, briefingsFromCsv, briefingsToText, looksLikeFormCsv, parseCsv } from '@/kv/briefing';
import { applyPlan, normalizePlan, outline, splitTemplate, TEMPLATE_PAGES } from '@/kv/structure';
import { normalizeSpec, type ManualAssets } from '@/kv/spec';
import { fillTemplate } from '@/kv/fillTemplate';

// Same shape as a Google Forms export (fictional client)
const FORM_CSV = [
  '"Carimbo de data/hora","Nome de usuário","Vocês possuem um manual de identidade visual da marca?","Em caso afirmativo, por favor, enviar o arquivo.","Qual persona decisora este design precisa impactar?","Existe alguma cor que NÃO devemos usar de jeito nenhum?","Quais são as características que a marca NÃO busca transmitir?"',
  '"2026/08/20 9:10:00 AM GMT-3","ana@cliente.com","Sim","https://drive.google.com/u/0/open?id=AAA;https://drive.google.com/u/0/open?id=BBB","Diretores de TI, ""com orçamento"", e gestores",""," inacessível, caro "',
  '"2026/08/26 6:03:51 PM GMT-3","bia@cliente.com","Sim, irei enviar abaixo","https://drive.google.com/u/0/open?id=CCC","Gestores de TI\ne donos de PME","vermelho","inacessível, caro"',
].join('\n');

describe('briefing', () => {
  it('parses quoted CSV with escaped quotes and line breaks', () => {
    const rows = parseCsv(FORM_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[1][4]).toBe('Diretores de TI, "com orçamento", e gestores');
    expect(rows[2][4]).toBe('Gestores de TI\ne donos de PME');
  });

  it('reads semicolon CSVs (Excel pt-BR)', () => {
    expect(parseCsv('a;b;c\n1;"2;3";4')).toEqual([['a', 'b', 'c'], ['1', '2;3', '4']]);
  });

  it('turns a Forms export into briefings, newest first, with attachments apart', () => {
    expect(looksLikeFormCsv(FORM_CSV)).toBe(true);
    expect(looksLikeFormCsv('nome,cor\nx,y')).toBe(false);
    const list = briefingsFromCsv(FORM_CSV, 'briefing.csv');
    expect(list).toHaveLength(2);
    const [b] = list;
    expect(b.respondente).toBe('bia@cliente.com');
    expect(b.anexos).toEqual(['https://drive.google.com/u/0/open?id=CCC']);
    expect(b.respostas.find((r) => /enviar o arquivo/.test(r.pergunta))?.resposta).toBe('1 arquivo(s) anexado(s) no Google Drive');
    expect(b.respostas.find((r) => /NÃO devemos/.test(r.pergunta))?.resposta).toBe('vermelho');
    // the older row skipped the empty color answer
    expect(list[1].respostas.some((r) => /NÃO devemos/.test(r.pergunta))).toBe(false);
    const text = briefingsToText([b]);
    expect(text).toContain('respondido por bia@cliente.com');
    expect(text).toContain('→ Gestores de TI');
    expect(text).toContain('NÃO foi lido');
  });

  it('reads question/answer pairs from a text briefing, or keeps the text', () => {
    const qa = briefingFromText('Qual o público?\nIndústrias.\nQual cor evitar?\nVermelho.\nTem banco de imagens?\nNão.', 'b.pdf');
    expect(qa.respostas).toEqual([
      { pergunta: 'Qual o público?', resposta: 'Indústrias.' },
      { pergunta: 'Qual cor evitar?', resposta: 'Vermelho.' },
      { pergunta: 'Tem banco de imagens?', resposta: 'Não.' },
    ]);
    const free = briefingFromText('Queremos algo moderno e técnico.', 'b.txt');
    expect(free.respostas).toHaveLength(0);
    expect(free.texto).toContain('moderno');
  });
});

const PLAN = normalizePlan({
  diagnostico: { problema: 'Rede instável e sem gestão', persona: 'Gestores de TI', atributos: ['Técnico', 'Confiável'], naoTransmitir: ['Caro', 'Inacessível'], restricoes: ['Usar só as cores do brandbook'], tomDeVoz: 'Técnico e próximo' },
  estrategia: { incluir: true, titulo: 'Estratégia de comunicação', texto: 'O que o briefing pede.' },
  paginas: [
    { id: 'lp', incluir: false }, { id: 'lp-logo', incluir: false }, { id: 'lp-margens', incluir: false },
    { id: 'lp-tipo-desktop-1', incluir: false }, { id: 'lp-tipo-desktop-2', incluir: false }, { id: 'lp-tipo-mobile-1', incluir: false },
    { id: 'lp-tipo-mobile-2', incluir: false }, { id: 'lp-tipo-auxiliar', incluir: false }, { id: 'lp-equivalencia-pesos', incluir: false },
    { id: 'lp-cta', incluir: false }, { id: 'lp-exemplo', incluir: false }, { id: 'lp-exemplo-topo', incluir: false }, { id: 'lp-exemplo-continuacao', incluir: false },
    { id: 'capa', incluir: false }, // essential: ignored
  ],
  notas: [{ id: 'logotipo', texto: 'Use **Omada** e VIGI como sub-marcas.' }, { id: 'imagens-regras', texto: 'sem nota nesta página' }],
  divisores: [{ id: 'banners', texto: 'Banners técnicos & confiáveis.' }],
  extras: [
    { id: 'persona', titulo: 'Persona decisora', depoisDe: 'estrategia', layout: 'persona', itens: [{ titulo: 'Gestor de TI', texto: 'Cuida da rede', lista: ['Painel único'] }] },
    { id: 'banco-imagens', titulo: 'Banco de imagens', depoisDe: 'imagens-exemplos', layout: 'fazer_nao_fazer', fazer: ['Ambientes reais'], naoFazer: ['Pose <forçada>'] },
    { id: 'sub', titulo: 'Arquitetura de marca', depoisDe: 'nao-existe', layout: 'cards', itens: [{ titulo: 'Omada', texto: 'Redes' }] },
  ],
  cobertura: [{ pergunta: 'Cor proibida?', resposta: 'vermelho', aplicacao: 'Regra na p. de cores', paginas: ['cores-primarias'], status: 'aplicado' }],
});

describe('manual structure', () => {
  it('finds the 38 template pages', () => {
    const s = splitTemplate(template);
    expect(s.pages.size).toBe(38);
    expect(TEMPLATE_PAGES.filter((p) => p.nota).every((p) => s.pages.get(p.id)!.includes('Orientações de uso'))).toBe(true);
  });

  it('normalizes the plan: essentials stay, unknown anchors go to the strategy chapter, notes only where they exist', () => {
    expect(PLAN.paginas.find((p) => p.id === 'capa')?.incluir).toBe(true);
    expect(PLAN.extras.find((e) => e.id === 'sub')?.depoisDe).toBe('estrategia');
    expect(PLAN.notas.map((n) => n.id)).toEqual(['logotipo']);
  });

  it('builds the outline: strategy chapter first, extras in place, empty chapters dropped', () => {
    const o = outline(PLAN);
    const keys = o.map((e) => e.key);
    expect(keys.slice(0, 7)).toEqual(['capa', 'sumario', 'estrategia', 'contexto', 'persona', 'sub', 'marca']);
    expect(keys[keys.indexOf('imagens-exemplos') + 1]).toBe('banco-imagens');
    expect(keys.some((k) => k.startsWith('lp'))).toBe(false);
    expect(o.map((e) => e.numero)).toEqual(o.map((_, i) => i + 1));
    expect(outline(null)).toHaveLength(38);
  });

  it('applies the plan to the HTML: renumbers, rebuilds the TOC, escapes AI text', () => {
    const r = applyPlan(template, PLAN, 'TP');
    const o = outline(PLAN);
    expect(r.pageCount).toBe(o.length);
    expect((r.html.match(/<div class="frame">/g) ?? []).length).toBe(o.length);
    const numbers = [...r.html.matchAll(/<div class="pg"><b>(\d+)<\/b>/g)].map((m) => Number(m[1]));
    expect(numbers).toEqual(o.slice(1).map((e) => e.numero)); // the cover has no footer
    expect(r.html).toContain('Use <b>Omada</b> e VIGI como sub-marcas.');
    expect(r.html).toContain('Banners técnicos &amp; confiáveis.');
    expect(r.html).toContain('Pose &lt;forçada&gt;');
    expect(r.html).not.toContain('Landing pages</span>');
    expect(r.html).toContain('<span>Persona decisora</span>');
    expect(r.log.every((l) => l.ok)).toBe(true);
  });

  it('goes through fillTemplate with no leftover markers', () => {
    const spec = normalizeSpec({ marca: 'TP', cores: { principal: { hex: '#0B2A4A', nome: 'Azul', uso: '' }, apoio: { hex: '#1B5FA8', nome: 'Apoio', uso: '' }, acento: { hex: '#F2A900', nome: 'Amarelo', uso: '' }, paleta: [], nota: '' } });
    const svg = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
    const assets: ManualAssets = { logoCor: svg, logoBranco: svg, logoNavy: svg, logoApoio: svg, logoPreto: svg, simboloCor: null, simboloBranco: null, simboloNavy: null, razaoLogo: 4, razaoSimbolo: 1, fotos: [] };
    const r = fillTemplate(spec, assets, { googleFontsQuery: null, plan: PLAN });
    expect(r.remainingMarkers).toEqual([]);
    expect(r.pageCount).toBe(outline(PLAN).length);
    expect(r.html).toContain('id="manual-fit"');
    expect(r.html).toContain('id="manual-extra"');
  });
});
