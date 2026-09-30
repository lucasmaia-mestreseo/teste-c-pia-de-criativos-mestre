/**
 * Delivery formats of the agency: ratio → exact pixels, and the safe zones
 * each platform covers with its interface. Shared by Gerar, Redimensionar
 * and Desdobramento so every piece follows the same rules.
 */

export const FORMAT_PIXELS: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
  "3:4": [1080, 1440],
  "1.91:1": [1200, 628],
};

/** Hard layout rules per format (appended to the image prompts). */
/**
 * Light layout reminder per format (appended to the image prompts). Kept to one
 * sentence on purpose: a long, strict rule made the stories noticeably worse.
 */
export const SAFE_ZONES: Record<string, string> = {
  "9:16": "Deixe um respiro de uns 250 px em cima e embaixo sem textos, logo ou CTA (a interface do Instagram cobre essas faixas); o fundo pode continuar normalmente ali.",
};

export const safeZoneRule = (format: string) => SAFE_ZONES[format] ?? "";
