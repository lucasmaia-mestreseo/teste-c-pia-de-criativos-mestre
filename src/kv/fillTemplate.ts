/**
 * Criação de KVs — fills the 38-page Agência Mestre manual template.
 *
 * Generic port of the per-brand `fill-*.mjs` scripts used when the manuals
 * were made by hand (SISPRO, CTD, Omada, VIGI, Mundo Apto, Kennedy, PHE):
 * tokens, markers, palette, CTA contrast, logos, photos, lists and leftovers.
 * Every structural replacement is logged, so a template change that breaks a
 * replacement shows up in the UI instead of silently producing a wrong page.
 */
import template from './manual-template.html?raw';
import { cmykLabel, contrast, normalizeHex, readableOn, rgbLabel, rgba } from './color';
import type { ManualAssets, ManualSpec } from './spec';

export interface FillLogEntry { ok: boolean; label: string }
export interface FillResult {
  html: string;
  log: FillLogEntry[];
  remainingMarkers: string[];
  leftoverTerms: string[];
  tokens: BrandTokens;
}

export { buildTokens, type BrandTokens } from './tokens';
import { buildTokens, type BrandTokens } from './tokens';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "Agência Mestre" signature of the footer (the original PNG is not in the repo). */
const AGENCIA_MESTRE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="232" height="40" viewBox="0 0 232 40">' +
  '<text x="0" y="29" font-family="Space Grotesk, Arial, sans-serif" font-size="27" fill="#333333">agência</text>' +
  '<rect x="112" y="6" width="2.5" height="28" fill="#333333"/>' +
  '<text x="124" y="29" font-family="Space Grotesk, Arial, sans-serif" font-size="27" font-weight="700" fill="#333333">mestre</text></svg>',
)}`;

/** Wide marks look right at the template's widths; near-square ones must shrink or they overflow. */
const WIDE_ENOUGH = 2.2;

export function fillTemplate(spec: ManualSpec, assets: ManualAssets, opts: { googleFontsQuery: string | null }): FillResult {
  let h = template;
  const log: FillLogEntry[] = [];
  const troca = (label: string, re: RegExp | string, por: string | ((...a: string[]) => string)) => {
    const antes = h;
    h = h.replace(re as RegExp, por as never);
    log.push({ ok: h !== antes, label });
  };
  const todas = (label: string, de: string, para: string) => {
    const n = h.split(de).length - 1;
    h = h.split(de).join(para);
    log.push({ ok: n > 0, label: `${label} (${n})` });
  };

  const tk = buildTokens(spec);
  const t = spec.tipografia;
  const marca = esc(spec.marca || 'Marca');

  /* ── fontes ─────────────────────────────────────────────────────── */
  if (opts.googleFontsQuery) {
    troca('link do Google Fonts', /family=«FONTE_PRIMARIA_URL»&family=«FONTE_SECUNDARIA_URL»/, opts.googleFontsQuery);
  } else {
    troca('link do Google Fonts removido (fontes de sistema)', /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=«FONTE_PRIMARIA_URL»[^>]*>/, '');
  }
  troca('bloco @font-face local', /\/\* ---------- FONTES LOCAIS \(opcional\)[\s\S]*?\*\//, `/* Fontes carregadas do Google Fonts pelo <link> do <head>. */`);

  /* ── notas ──────────────────────────────────────────────────────── */
  const notaCores = spec.cores.nota ||
    `${esc(spec.cores.principal.nome)} domina: fundos, títulos e assinatura. ${esc(spec.cores.apoio.nome)} apoia em títulos, links e cards. ${esc(spec.cores.acento.nome)} é acento — CTA e destaques —, nunca a cor dominante de uma peça.`;
  troca('nota de cores primárias', /«NOTA_CORES_PRIMARIAS[^»]*»/, esc(notaCores));
  if (t.nota) troca('nota de tipografia', /«NOTA_TIPOGRAFIA[^»]*»/, esc(t.nota));
  else troca('nota de tipografia removida', /<p><b>Nota para aprovação:<\/b> «NOTA_TIPOGRAFIA[^»]*»<\/p>/, '');
  const inkName = tk.ctaInk === '#FFFFFF' ? 'branco' : `escuro (${tk.ctaInk})`;
  troca('regra de cor do CTA', /«REGRA_DE_COR_DO_CTA[^»]*»/,
    `Fundo ${spec.cores.acento.hex.toUpperCase()} com texto ${inkName} Bold — contraste ${String(tk.ctaRatio).replace('.', ',')}:1${tk.ctaRatio >= 4.5 ? '' : ' (use só em texto grande)'}.`);

  /* ── valores derivados em sequência (p.09 e p.10) ───────────────── */
  {
    const seq = [tk.brand950, tk.brand700, tk.brand500, tk.brand400, tk.brand100, tk.brand050];
    let i = 0;
    h = h.replace(/«HEX»/g, (m) => (i < seq.length ? seq[i++] : m));
    log.push({ ok: i === 6, label: `${i}/6 hex derivados (p.10)` });
  }
  {
    const seq = [tk.brand900, tk.brand600, tk.accent700, tk.accent900];
    let r = 0;
    let c = 0;
    h = h.replace(/«RGB»/g, (m) => (r < seq.length ? rgbLabel(seq[r++]) : m));
    h = h.replace(/«CMYK»/g, (m) => (c < seq.length ? cmykLabel(seq[c++]) : m));
    log.push({ ok: r === 4 && c === 4, label: `RGB/CMYK das 4 cores primárias (${r}/${c})` });
  }

  /* ── marcadores simples ─────────────────────────────────────────── */
  const card = (i: number) => spec.lp.cards[i] ?? { titulo: '', texto: '' };
  const valores: Record<string, string> = {
    '«AZUL_PROFUNDO»': tk.brand950,
    '«COR_PRINCIPAL»': tk.brand900,
    '«DERIVADO_MEDIO»': tk.brand700,
    '«COR_APOIO»': tk.brand600,
    '«DERIVADO_CLARO»': tk.brand500,
    '«DERIVADO_SUAVE»': tk.brand400,
    '«DERIVADO_ROTULO»': tk.brand300,
    '«DERIVADO_TEXTO_SOBRE_ESCURO»': tk.brand200,
    '«DERIVADO_NEVOA»': tk.brand100,
    '«DERIVADO_FUNDO»': tk.brand050,
    '«COR_ACENTO»': tk.accent700,
    '«ACENTO_HOVER»': tk.accent800,
    '«ACENTO_ESCURO»': tk.accent900,
    '«FONTE_PRIMARIA»': t.primaria,
    '«FONTE_SECUNDARIA»': t.secundaria || t.primaria,
    '«FONTE_AUXILIAR_PRIMARIA»': t.auxiliarPrimaria,
    '«FONTE_AUXILIAR_SECUNDARIA»': t.auxiliarSecundaria,
    '«RAZAO_ASSINATURA»': String(assets.razaoLogo || 3),
    '«RAZAO_SIMBOLO»': String(assets.razaoSimbolo || 1),
    '«RGBA_VEU»': rgba(tk.brand900, 0.88),
    '«MARCA»': marca,
    '«SLOGAN»': esc(spec.slogan),
    '«HEADLINE_PRINCIPAL»': esc(spec.headlinePrincipal),
    '«HEADLINE_SECUNDARIA»': esc(spec.headlineSecundaria),
    '«HEADLINE_TERCEIRA»': esc(spec.headlineTerceira),
    '«POSICIONAMENTO»': esc(spec.posicionamento),
    '«TEXTO_DE_APOIO»': esc(spec.textoDeApoio),
    '«LP_TITULO_SECAO_1»': esc(spec.lp.tituloSecao1),
    '«LP_TITULO_SECAO_2»': esc(spec.lp.tituloSecao2),
    '«LP_SUBTITULO_HERO»': esc(spec.lp.subtituloHero),
    '«LP_TEXTO_SECAO_2»': esc(spec.lp.textoSecao2),
    '«PRODUTO»': esc(spec.produto || spec.marca),
    '«CTA_INSTITUCIONAL»': esc(spec.cta.institucional.toUpperCase()),
    '«LP_CARD_1_TITULO»': esc(card(0).titulo), '«LP_CARD_1_TEXTO»': esc(card(0).texto),
    '«LP_CARD_2_TITULO»': esc(card(1).titulo), '«LP_CARD_2_TEXTO»': esc(card(1).texto),
    '«LP_CARD_3_TITULO»': esc(card(2).titulo), '«LP_CARD_3_TEXTO»': esc(card(2).texto),
    '«LP_RODAPE_LINKS»': esc(spec.lp.rodapeLinks).replace(/\n/g, '<br>'),
    '«HEX_PRINCIPAL»': tk.brand900, '«USO_PRINCIPAL»': esc(spec.cores.principal.nome),
    '«HEX_APOIO»': tk.brand600, '«USO_APOIO»': esc(spec.cores.apoio.nome),
    '«HEX_ACENTO»': tk.accent700, '«USO_ACENTO»': esc(spec.cores.acento.nome),
    '«HEX_ACENTO_ESCURO»': tk.accent900, '«USO_ACENTO_ESCURO»': 'Acento escuro',
    '«NOME_COR_PRINCIPAL»': esc(spec.cores.principal.nome), '«NOME_COR_APOIO»': esc(spec.cores.apoio.nome),
    '«HEX_NEVOA»': tk.brand100, '«HEX_FUNDO»': tk.brand050,
    '«HEX_TEXTO_SOBRE_ESCURO»': tk.brand200, '«HEX_SUPERFICIE»': tk.brand050,
    '«POSICAO_FOTO_DO»': focus(assets.fotos[1]?.foco),
  };
  for (const [k, v] of Object.entries(valores)) h = h.split(k).join(v);

  /* ── paleta oficial (p.09) ──────────────────────────────────────── */
  const paleta = spec.cores.paleta.filter((c) => normalizeHex(c.hex));
  if (paleta.length >= 4) {
    const cols = Math.min(8, paleta.length);
    troca(`paleta primária (${cols} cores)`,
      /<div class="band">Primárias<\/div>\s*<div class="swatches">[\s\S]*?(<\/div>\s*<div class="note">)/,
      (_m: string, fim: string) => `<div class="band">Primárias</div>
    <div class="swatches" style="grid-template-columns:repeat(${cols},1fr);gap:16px">
${paleta.slice(0, 8).map((c) => {
        const hex = normalizeHex(c.hex)!;
        const border = contrast(hex, '#FFFFFF') < 1.15 ? ';border:1px solid var(--rule)' : '';
        return `      <div class="sw"><div class="chip" style="background:${hex}${border}"></div><div class="hex">${hex}</div><div class="use">${esc(c.nome)}</div><div class="val">${rgbLabel(hex)}<br>${esc(c.uso)}</div></div>`;
      }).join('\n')}
    ` + fim);
  }

  /* ── CTA: cor do texto pelo contraste ───────────────────────────── */
  h = h.replace('--accent-900:', `--cta-ink:${tk.ctaInk};\n  --accent-900:`);
  // covers the .btn rule and every inline CTA of the mockups
  todas('texto do botão pelo contraste', 'background:var(--accent-700);color:#fff;', 'background:var(--accent-700);color:var(--cta-ink);');
  troca('botão institucional mantém texto branco', '.btn.solid-blue{background:var(--brand-900)}', `.btn.solid-blue{background:var(--brand-900);color:${readableOn(tk.brand900).color}}`);

  /* ── textos de CTA e navegação da LP (o template veio de um B2B) ── */
  for (const [de, para] of [
    ['SOLICITE UMA DEMONSTRAÇÃO →', `${spec.cta.principal.toUpperCase()} →`],
    ['SOLICITE UMA DEMONSTRAÇÃO', spec.cta.principal.toUpperCase()],
    ['SOLICITE UMA DEMO', spec.cta.demo.toUpperCase()],
    ['FALE COM UM ESPECIALISTA', spec.cta.principal.toUpperCase()],
    ['BAIXE O MATERIAL', spec.cta.material.toUpperCase()],
    ['CONHEÇA AS SOLUÇÕES', spec.cta.solucoes.toUpperCase()],
  ] as const) h = h.split(de).join(esc(para));
  const menu = spec.lp.menu.slice(0, 4);
  troca('menu da LP', '<span>Soluções</span><span>Segmentos</span><span>Conteúdo</span><span>Contato</span>',
    menu.map((m) => `<span>${esc(m)}</span>`).join(''));
  troca('rodapé da LP', />Soluções<\/b>/, `>${esc(menu[0] ?? 'Início')}</b>`);

  /* ── p.12 direção de imagem e p.23–25 criativos ─────────────────── */
  const ul = (items: string[], cls: string) => `<ul class="${cls}">\n${items.map((i) => `          <li>${esc(i)}</li>`).join('\n')}\n        </ul>`;
  if (spec.imagens.fazer.length) troca('lista "fazer" (imagens)', /<ul class="dd do">[\s\S]*?<\/ul>/, ul(spec.imagens.fazer, 'dd do'));
  if (spec.imagens.naoFazer.length) troca('lista "não fazer" (imagens)', /<ul class="dd dont">[\s\S]*?<\/ul>/, ul(spec.imagens.naoFazer, 'dd dont'));
  {
    let i = 0;
    h = h.replace(/<ul class="dd do" style="border:none;padding:0;flex:1">[\s\S]*?<\/ul>/g, (m) => {
      const items = spec.criativos[i++];
      if (!items?.length) return m;
      return `<ul class="dd do" style="border:none;padding:0;flex:1">\n${items.map((t2) => `        <li>${esc(t2)}</li>`).join('\n')}\n      </ul>`;
    });
    log.push({ ok: i === 3, label: `${i}/3 descrições de criativos` });
  }

  /* ── logos: tamanho pela proporção real, depois as imagens ─────── */
  const r = assets.razaoLogo || 3;
  if (r < WIDE_ENOUGH) {
    let n = 0;
    h = h.replace(/<img([^>]*?)src="assets\/logo-([a-z-]+)\.svg"([^>]*?)>/g, (tag) => {
      const m = tag.match(/style="([^"]*)"/);
      if (!m || /height\s*:/.test(m[1])) return tag;
      const w = m[1].match(/width:(\d+)px/);
      if (!w) return tag;
      n++;
      const nw = Math.round((Number(w[1]) * r) / WIDE_ENOUGH);
      return tag.replace(`width:${w[1]}px`, `width:${nw}px`);
    });
    log.push({ ok: true, label: `${n} logos redimensionados para marca quase quadrada (razão ${r})` });
  }
  h = h.replace('style="width:210px;height:130px;display:block"', 'style="width:210px;height:130px;object-fit:contain;display:block"');
  {
    // área de proteção: X = largura do símbolo no tamanho mostrado
    const shownW = r < WIDE_ENOUGH ? (460 * r) / WIDE_ENOUGH : 460;
    const frac = assets.simboloFracao;
    if (frac && frac > 0 && frac < 1) {
      troca(`área de proteção (X = ${Math.round(shownW * frac)} px)`, /(<div class="guard" style="padding:)69px/, `$1${Math.round(shownW * frac)}px`);
    } else {
      const x = Math.round((shownW / r) * 0.5);
      troca(`área de proteção (X = ${x} px)`, /(<div class="guard" style="padding:)69px/, `$1${x}px`);
      troca('legenda do X', /<b>X = largura do símbolo\.<\/b>/, '<b>X = metade da altura da assinatura.</b>');
    }
    h = h.replace(/<!-- marca de 460px -> X = [^>]*-->/, '');
  }
  const logoMap: Record<string, string | null | undefined> = {
    'logo-cor': assets.logoCor,
    'logo-cor-tagline': assets.logoCorTagline || assets.logoCor,
    'logo-branco': assets.logoBranco,
    'logo-branco-tagline': assets.logoBrancoTagline || assets.logoBranco,
    'logo-navy': assets.logoNavy,
    'logo-apoio': assets.logoApoio,
    'logo-preto': assets.logoPreto,
    'simbolo-cor': assets.simboloCor || assets.logoCor,
    'simbolo-navy': assets.simboloNavy || assets.logoNavy,
    'simbolo-branco': assets.simboloBranco || assets.logoBranco,
  };
  const registry: Record<string, string> = {};
  for (const [name, url] of Object.entries(logoMap)) {
    if (url) registry[`assets/${name}.svg`] = url;
    else log.push({ ok: false, label: `sem arquivo para ${name}` });
  }

  /* ── fotos: recorte pelo foco de cada imagem ────────────────────── */
  assets.fotos.slice(0, 3).forEach((f, i) => {
    const file = `foto-0${i + 1}.jpg`;
    const pos = focus(f.foco);
    // CSS backgrounds: url('assets/foto-0N.jpg') <pos>/cover
    h = h.replace(new RegExp(`(url\\('assets/${file.replace('.', '\\.')}'\\)\\s*)([^/;]+?)(/cover)`, 'g'), `$1${pos}$3`);
    // <img ... object-position:X Y> (except the deliberately bad crop, which uses transform:scale)
    h = h.replace(new RegExp(`(src="assets/${file.replace('.', '\\.')}"[^>]*?object-position:)([^;"]+)(;(?![^>]*transform:scale))`, 'g'), `$1${pos}$3`);
    registry[`assets/${file}`] = f.url;
  });
  if (assets.fotos.length < 3) log.push({ ok: false, label: `apenas ${assets.fotos.length}/3 fotos — as páginas de imagem ficam incompletas` });
  registry['assets/agencia-mestre.png'] = AGENCIA_MESTRE;

  h = embedAssets(h, registry);
  log.push({ ok: true, label: `${Object.keys(registry).length} imagens embutidas uma única vez` });

  /* ── conferência final ──────────────────────────────────────────── */
  const remainingMarkers = [...new Set(h.match(/«[^»]+»/g) ?? [])];
  h = h.replace(/«[^»]+»/g, '');
  const semComentario = h.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/data:[^"')]+/g, '');
  const leftoverTerms = [...new Set((semComentario.match(/\b(SISPRO|Sábio|Gotham|Quicksand|ERP|Brand Book p\.\d+|B2B)\b/g) ?? []))];
  return { html: h, log, remainingMarkers, leftoverTerms, tokens: tk };
}

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Percent-encoded SVG data URLs are ~2.5× bigger than base64. */
function compactDataUrl(url: string): string {
  const m = url.match(/^data:image\/svg\+xml;charset=utf-8,(.*)$/s);
  if (!m) return url;
  try {
    const svg = decodeURIComponent(m[1]);
    const bin = new TextEncoder().encode(svg);
    let s = '';
    for (let i = 0; i < bin.length; i += 0x8000) s += String.fromCharCode(...bin.subarray(i, i + 0x8000));
    return `data:image/svg+xml;base64,${btoa(s)}`;
  } catch {
    return url;
  }
}

/**
 * Put every image in the document ONCE: <img> tags get a placeholder plus
 * data-asset, filled by a tiny script; CSS backgrounds use custom properties.
 * (Inlining at each use made a manual weigh 12 MB — the logo appears ~70×.)
 */
function embedAssets(html: string, registry: Record<string, string>): string {
  const cssVars: string[] = [];
  const varName = (path: string) => `--a-${path.replace(/^assets\//, '').replace(/[^a-z0-9]+/gi, '-')}`;
  const all: Record<string, string> = {};
  for (const [path, url] of Object.entries(registry)) all[path] = compactDataUrl(url);
  // each image goes either to the <img> map or to a CSS variable (or both, only if used both ways)
  const map: Record<string, string> = {};
  let h = html.replace(/<img([^>]*?)src="(assets\/[^"]+)"/g, (m, pre: string, path: string) => {
    if (!all[path]) return m;
    map[path] = all[path];
    return `<img${pre}src="${PIXEL}" data-asset="${path}"`;
  });
  const inCss = new Set<string>();
  h = h.replace(/url\('(assets\/[^']+)'\)/g, (m, path: string) => {
    if (!all[path]) return m;
    inCss.add(path);
    return `var(${varName(path)})`;
  });
  for (const path of inCss) cssVars.push(`  ${varName(path)}:url("${all[path]}");`);
  const style = `<style id="manual-assets">\n:root{\n${cssVars.join('\n')}\n}\n</style>`;
  // fallbacks (tagline → logo, symbol → logo) share the same image: store each distinct URL once
  const unique: string[] = [];
  const index: Record<string, number> = {};
  for (const [path, url] of Object.entries(map)) {
    let i = unique.indexOf(url);
    if (i < 0) i = unique.push(url) - 1;
    index[path] = i;
  }
  const script = `<script id="manual-assets-map">
(function(){var U=${JSON.stringify(unique)},A=${JSON.stringify(index)};
document.querySelectorAll('img[data-asset]').forEach(function(i){var k=A[i.getAttribute('data-asset')];if(k!==undefined)i.src=U[k];});})();
</script>`;
  h = h.replace('</head>', `${style}\n</head>`);
  // before the template's own script (it measures the slides)
  const lastScript = h.lastIndexOf('<script>');
  return lastScript > 0 ? `${h.slice(0, lastScript)}${script}\n${h.slice(lastScript)}` : h.replace('</body>', `${script}\n</body>`);
}

function focus(f?: { x: number; y: number }): string {
  if (!f) return 'center center';
  const p = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  return `${p(f.x)} ${p(f.y)}`;
}
