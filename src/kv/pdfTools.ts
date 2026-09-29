/**
 * Criação de KVs — reading PDFs in the browser (pdf.js, loaded on demand).
 *
 * From each PDF (brandbook, presentation, portfolio...) we take:
 *  - the text of the first pages (tone, positioning, products);
 *  - the names of the embedded fonts — the most reliable typography evidence
 *    (the original workflow used `pdffonts` for exactly this);
 *  - page renders, sent to the AI to read palettes/logos and to crop photos.
 */
import { makeCanvas } from './imageTools';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export interface PdfPage {
  number: number;
  canvas: HTMLCanvasElement;
}

export interface PdfReadResult {
  pageCount: number;
  text: string;
  fonts: string[];
  pages: PdfPage[];
}

/** Clean "ABCDEF+Montserrat-SemiBold" → "Montserrat SemiBold". */
export function cleanFontName(raw: string): string {
  return raw
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/[-_,]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+(MT|PS|Std|Pro)$/i, '')
    .trim();
}

/** Family part of a clean font name ("Montserrat SemiBold" → "Montserrat"). */
export function fontFamilyOf(name: string): string {
  return name
    .replace(/\s+(Thin|Hairline|Extra ?Light|Ultra ?Light|Light|Regular|Book|Normal|Medium|Semi ?Bold|Demi ?Bold|Bold|Extra ?Bold|Ultra ?Bold|Black|Heavy|Italic|Oblique|It|Condensed|Cond)(\s|$).*$/i, '')
    .trim();
}

export async function readPdf(
  data: ArrayBuffer,
  opts: { maxTextPages?: number; maxRenderPages?: number; renderWidth?: number; onProgress?: (msg: string) => void } = {},
): Promise<PdfReadResult> {
  const { maxTextPages = 40, maxRenderPages = 10, renderWidth = 1400, onProgress } = opts;
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const pageCount = doc.numPages;
  const fonts = new Set<string>();
  const texts: string[] = [];
  const pages: PdfPage[] = [];

  // Pick evenly spread pages to render (covers, palette and logo pages are usually spread out).
  const renderSet = new Set<number>();
  const nRender = Math.min(maxRenderPages, pageCount);
  for (let i = 0; i < nRender; i++) renderSet.add(1 + Math.round((i * (pageCount - 1)) / Math.max(1, nRender - 1)));

  for (let n = 1; n <= Math.min(pageCount, Math.max(maxTextPages, ...renderSet)); n++) {
    onProgress?.(`Lendo página ${n} de ${pageCount}…`);
    const page = await doc.getPage(n);

    if (n <= maxTextPages) {
      const content = await page.getTextContent();
      const line = content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
      if (line) texts.push(`[p.${n}] ${line}`);
    }

    if (renderSet.has(n)) {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: renderWidth / base.width });
      const canvas = makeCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // intent "print" renders without requestAnimationFrame, so reading keeps
      // going when the browser tab is in the background (rAF is paused there).
      await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
      pages.push({ number: n, canvas });

      // Fonts are resolved on the main thread once the page is rendered.
      try {
        const ops = await page.getOperatorList();
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] !== pdfjs.OPS.setFont) continue;
          const ref = ops.argsArray[i]?.[0];
          if (typeof ref !== 'string') continue;
          try {
            const font = page.commonObjs.get(ref) as { name?: string } | undefined;
            if (font?.name) fonts.add(cleanFontName(font.name));
          } catch { /* not resolved */ }
        }
      } catch { /* font names are best-effort */ }
    }
    page.cleanup();
  }
  await doc.destroy();

  return { pageCount, text: texts.join('\n').slice(0, 24000), fonts: [...fonts].filter(Boolean).sort(), pages };
}
