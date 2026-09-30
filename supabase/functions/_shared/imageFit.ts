/**
 * Formats with an exact pixel size that image models can't produce directly
 * (they only take standard aspect ratios). The piece is generated in the
 * closest supported ratio with a safety margin, then cropped to the exact
 * ratio and resized here.
 */
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export interface ExactFormat {
  width: number;
  height: number;
  /** Ratio sent to the model. */
  generateAs: string;
  /** What the prompt tells the model about the crop. */
  cropNote: string;
}

export const EXACT_FORMATS: Record<string, ExactFormat> = {
  "1.91:1": {
    width: 1200,
    height: 628,
    generateAs: "16:9",
    cropNote:
      "A imagem será gerada em 16:9 e depois recortada para 1,91:1 (1200×628, banner de link do Facebook): cerca de 4% de cima e 4% de baixo serão cortados. Deixe essas faixas só com fundo — nenhum texto, logo, rosto ou produto nelas.",
  },
};

/** Center-crop to the exact ratio and resize to the exact size. Returns PNG bytes. */
export async function fitExact(bytes: Uint8Array, target: ExactFormat): Promise<Uint8Array> {
  const decoded = await Image.decode(bytes);
  if (!(decoded instanceof Image)) throw new Error("formato de imagem inesperado");
  const img = decoded;
  const ratio = target.width / target.height;
  let cw = img.width;
  let ch = img.height;
  if (img.width / img.height > ratio) cw = Math.round(img.height * ratio);
  else ch = Math.round(img.width / ratio);
  img.crop(Math.round((img.width - cw) / 2), Math.round((img.height - ch) / 2), cw, ch);
  img.resize(target.width, target.height);
  return await img.encode(1);
}
