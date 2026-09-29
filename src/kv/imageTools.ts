/**
 * Criação de KVs — in-browser image processing (canvas).
 *
 * Mirrors what was done by hand in the original manual workflow:
 *  - logos: remove flat background, crop to the ink bounding box, measure the
 *    real ratio, build mono variants (white / brand / support / black) keeping
 *    knockouts, and optionally vectorize (ImageTracer → SVG);
 *  - palette: measure the dominant colors from the pixels;
 *  - photos: crop regions (e.g. from PDF pages) and downscale.
 */
import { rgbToHex, saturation } from './color';

export type Box = { x0: number; y0: number; x1: number; y1: number }; // fractions 0–1

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem'));
    img.src = src;
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

/** Draw an image into a canvas, scaling so the longest side is at most `max` (and at least `min` for small logos). */
export function imageToCanvas(img: CanvasImageSource & { width: number; height: number }, max = 1600, min = 0): HTMLCanvasElement {
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  let scale = Math.min(1, max / Math.max(w, h));
  if (min && Math.max(w, h) * scale < min) scale = min / Math.max(w, h);
  const c = makeCanvas(w * scale, h * scale);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function canvasToDataUrl(c: HTMLCanvasElement, type: 'image/png' | 'image/jpeg' = 'image/png', quality = 0.9): string {
  return c.toDataURL(type, quality);
}

/** Share of pixels that are (partly) transparent. */
export function transparencyShare(c: HTMLCanvasElement): number {
  const { data } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  let t = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] < 250) t++;
  return t / (data.length / 16);
}

/**
 * Remove a flat background (the color touching the borders) by flood fill, so
 * inner areas of the same color (e.g. white counters inside letters) survive.
 * Pixels close to the background get partial alpha for a soft edge.
 */
export function removeFlatBackground(src: HTMLCanvasElement, tolerance = 38): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const W = c.width;
  const H = c.height;

  // background = most common color among border pixels
  const counts = new Map<string, number>();
  const sample = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    const k = `${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (let x = 0; x < W; x += 2) { sample(x, 0); sample(x, H - 1); }
  for (let y = 0; y < H; y += 2) { sample(0, y); sample(W - 1, y); }
  const [bgKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const [br, bg, bb] = bgKey.split(',').map((v) => Number(v) * 8 + 4);

  const dist = (i: number) => Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb);
  const visited = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const dd = dist(i);
    if (dd > tolerance * 1.8) continue; // ink: stop here
    // soft edge: fully transparent near the bg color, partial alpha on the anti-aliased ring
    d[i + 3] = dd <= tolerance ? 0 : Math.round(d[i + 3] * ((dd - tolerance) / (tolerance * 0.8)));
    if (dd > tolerance) continue;
    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Tight bounding box of visible pixels (alpha > threshold), in pixels. */
export function inkBox(c: HTMLCanvasElement, alphaThreshold = 16): { x: number; y: number; w: number; h: number } | null {
  const { data } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > alphaThreshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(c: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }, pad = 0): HTMLCanvasElement {
  const out = makeCanvas(box.w + pad * 2, box.h + pad * 2);
  ctx2d(out).drawImage(c, box.x, box.y, box.w, box.h, pad, pad, box.w, box.h);
  return out;
}

export function cropFraction(c: HTMLCanvasElement, b: Box): HTMLCanvasElement {
  const x = Math.max(0, Math.min(1, Math.min(b.x0, b.x1))) * c.width;
  const y = Math.max(0, Math.min(1, Math.min(b.y0, b.y1))) * c.height;
  const w = Math.abs(b.x1 - b.x0) * c.width;
  const h = Math.abs(b.y1 - b.y0) * c.height;
  return crop(c, { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) });
}

/** Trim to the ink with a small safety margin (so no pixel of the mark gets cut). */
export function trimToInk(c: HTMLCanvasElement): HTMLCanvasElement {
  const box = inkBox(c);
  if (!box) return c;
  return crop(c, box, Math.round(Math.max(box.w, box.h) * 0.01));
}

function isLight(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 225 && max - min < 28;
}

/** Share of the visible pixels that are near-white (to spot "negative" logos). */
export function lightInkShare(c: HTMLCanvasElement): number {
  const { data } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  let ink = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 64) continue;
    ink++;
    if (isLight(data[i], data[i + 1], data[i + 2])) light++;
  }
  return ink ? light / ink : 0;
}

/**
 * Mono version of a logo in `hex`, keeping the alpha. Near-white details
 * (counters, inner strokes) become holes, so the mark keeps its drawing on any
 * background — the "branco/navy/preto" versions of the manual.
 */
export function monoVariant(src: HTMLCanvasElement, hex: string, knockoutLight = true): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (knockoutLight && isLight(d[i], d[i + 1], d[i + 2])) {
      d[i + 3] = 0;
      continue;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Dominant colors of the visible pixels (neutrals reported separately). */
export function dominantColors(c: HTMLCanvasElement, max = 6): { hex: string; share: number; neutral: boolean }[] {
  const { data } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  const step = Math.max(1, Math.floor(data.length / 4 / 60000)) * 4;
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += data[i]; bk.g += data[i + 1]; bk.b += data[i + 2];
    buckets.set(key, bk);
    total++;
  }
  const colors = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((bk) => ({ hex: rgbToHex([bk.r / bk.n, bk.g / bk.n, bk.b / bk.n]), n: bk.n }));
  // merge near-duplicates
  const merged: { hex: string; n: number }[] = [];
  for (const col of colors) {
    const [r, g, b] = [1, 3, 5].map((o) => parseInt(col.hex.slice(o, o + 2), 16));
    const near = merged.find((m) => {
      const [mr, mg, mb] = [1, 3, 5].map((o) => parseInt(m.hex.slice(o, o + 2), 16));
      return Math.hypot(r - mr, g - mg, b - mb) < 40;
    });
    if (near) near.n += col.n; else merged.push({ ...col });
  }
  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((m) => ({ hex: m.hex, share: total ? m.n / total : 0, neutral: saturation(m.hex) < 0.12 }));
}

/** Downscaled JPEG for sending to the AI. */
export function forAI(c: HTMLCanvasElement, max = 1024): string {
  const scale = Math.min(1, max / Math.max(c.width, c.height));
  const out = makeCanvas(c.width * scale, c.height * scale);
  const ctx = ctx2d(out);
  ctx.fillStyle = '#FFFFFF'; // JPEG has no alpha: flatten on white
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.82);
}

/** Checkerboard-free preview background helper for mono variants shown in UI. */
export function ratioOf(c: HTMLCanvasElement): number {
  const box = inkBox(c);
  return box ? +(box.w / box.h).toFixed(4) : +(c.width / c.height).toFixed(4);
}

/* ─── vectorization (Web Worker) ─── */

let worker: Worker | null = null;
let jobSeq = 0;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./vectorize.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; svg?: string; error?: string }>) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.svg) job.resolve(e.data.svg); else job.reject(new Error(e.data.error ?? 'Falha na vetorização'));
    };
    // If the worker can't load (network, CSP, stale dev bundle), fail every job
    // right away — callers fall back to PNG instead of waiting for the timeout.
    const failAll = (msg: string) => {
      for (const [id, job] of pending) { pending.delete(id); job.reject(new Error(msg)); }
      worker?.terminate();
      worker = null;
    };
    worker.onerror = (ev) => { ev.preventDefault?.(); failAll('O vetorizador não carregou'); };
    worker.onmessageerror = () => failAll('Falha ao ler o resultado da vetorização');
  }
  return worker;
}

/**
 * Trace a (logo) canvas into raw SVG markup, in a worker, with a time limit.
 * Traced at ~800 px on the longest side: plenty for a logo that is shown at
 * ≤560 px, and fast enough (the tracer is O(pixels × colors)).
 */
export function traceToSvg(c: HTMLCanvasElement, colors = 6, timeoutMs = 25000): Promise<string> {
  const target = 800;
  const src = Math.max(c.width, c.height) === target ? c : imageToCanvas(c, target, target);
  const imgd = ctx2d(src).getImageData(0, 0, src.width, src.height);
  const id = ++jobSeq;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // a stuck trace would block the next jobs: start a fresh worker
      worker?.terminate();
      worker = null;
      reject(new Error('Vetorização demorou demais'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (s) => { clearTimeout(timer); resolve(cleanTracedSvg(s)); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    getWorker().postMessage({ id, imgd, colors });
  });
}

/** Drop invisible layers (the removed background) from ImageTracer output. */
function cleanTracedSvg(svg: string): string {
  return svg.replace(/<path[^>]*?opacity="(0(?:\.0\d*)?)"[^>]*\/>/g, '');
}

const PATH_RGB = /fill="rgb\((\d+),(\d+),(\d+)\)"/;

/**
 * Mono version of a traced logo: every visible path takes `hex`; near-white
 * paths (counters, inner details) are dropped so they become holes — same rule
 * as `monoVariant` for rasters.
 */
export function recolorSvg(svg: string, hex: string): string {
  return svg.replace(/<path[^>]*\/>/g, (p) => {
    const m = p.match(PATH_RGB);
    if (!m) return p;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isLight(r, g, b)) return '';
    return p.replace(/fill="rgb\([^)]*\)"/, `fill="${hex}"`).replace(/stroke="rgb\([^)]*\)"/, `stroke="${hex}"`);
  });
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
