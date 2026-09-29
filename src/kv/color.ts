/** Color helpers for the brand manual (Criação de KVs). */

export type RGB = [number, number, number];

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let h = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : null;
}

export function hexToRgb(hex: string): RGB {
  const h = normalizeHex(hex) ?? '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Linear mix: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export const tint = (hex: string, t: number) => mix(hex, '#FFFFFF', t);
export const shade = (hex: string, t: number) => mix(hex, '#000000', t);

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbLabel(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `RGB ${r}/${g}/${b}`;
}

/** Naive RGB→CMYK (no color profile) — good enough as a reference value in a digital manual. */
export function cmykLabel(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as RGB;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return 'CMYK 0/0/0/100';
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  const p = (v: number) => Math.round(v * 100);
  return `CMYK ${p(c)}/${p(m)}/${p(y)}/${p(k)}`;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Chroma (max − min, 0–1), used to tell neutrals from brand colors. HSL
 * saturation is useless here: it explodes near white/black (#FEFEFF → 100%).
 */
export function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Best readable text color over a background: white, or the given dark fallback. */
export function readableOn(bg: string, dark = '#111111'): { color: string; ratio: number } {
  const w = contrast('#FFFFFF', bg);
  const d = contrast(dark, bg);
  return w >= d ? { color: '#FFFFFF', ratio: w } : { color: dark, ratio: d };
}
