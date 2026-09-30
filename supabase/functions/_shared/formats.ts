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
  "1.91:1": [1200, 628],
};

/** Hard layout rules per format (appended to the image prompts). */
export const SAFE_ZONES: Record<string, string> = {
  "9:16":
    "ZONA SEGURA DO STORY (1080×1920): o Instagram cobre os 250 px de CIMA e os 250 px de BAIXO (cerca de 13% da altura em cada ponta). " +
    "NENHUM texto, logo, CTA, selo ou rosto pode ficar nessas faixas — ali só fundo ou cenário. " +
    "Deixe também ~65 px (6%) de respiro nas laterais: nada importante encostado nos cantos. " +
    "Headline, CTA e logo ficam na área central, entre 250 px e 1670 px de altura.",
};

export const safeZoneRule = (format: string) => SAFE_ZONES[format] ?? "";
