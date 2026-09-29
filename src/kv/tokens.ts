/**
 * Brand color scale derived from the manual's three colors. Kept apart from
 * fillTemplate so light modules (Brand Kit banner, manualStorage) don't pull
 * the 38-page template into the main bundle.
 */
import { mix, normalizeHex, readableOn, shade, tint } from './color';
import type { ManualSpec } from './spec';

export interface BrandTokens {
  brand950: string; brand900: string; brand700: string; brand600: string; brand500: string;
  brand400: string; brand300: string; brand200: string; brand100: string; brand050: string;
  accent700: string; accent800: string; accent900: string;
  ctaInk: string; ctaRatio: number;
}

/** Derive the full scale from the three brand colors (same scheme as the hand-made manuals). */
export function buildTokens(spec: ManualSpec): BrandTokens {
  const principal = normalizeHex(spec.cores.principal.hex) ?? '#1B2752';
  const apoio = normalizeHex(spec.cores.apoio.hex) ?? tint(principal, 0.3);
  const acento = normalizeHex(spec.cores.acento.hex) ?? apoio;
  const profundo = normalizeHex(spec.cores.profundo) ?? shade(principal, 0.35);
  const cta = readableOn(acento, shade(principal, 0.45));
  return {
    brand950: profundo,
    brand900: principal,
    brand700: mix(principal, apoio, 0.45),
    brand600: apoio,
    brand500: tint(apoio, 0.3),
    brand400: tint(apoio, 0.55),
    brand300: tint(principal, 0.55),
    brand200: tint(principal, 0.8),
    brand100: tint(principal, 0.9),
    brand050: tint(principal, 0.96),
    accent700: acento,
    accent800: shade(acento, 0.12),
    accent900: shade(acento, 0.28),
    ctaInk: cta.color,
    ctaRatio: +cta.ratio.toFixed(1),
  };
}
