/**
 * File names in the agency pattern and delivery at the exact size of the format:
 *   [Spasso Splash] [1080x1350] [B01] Solicitação de Banners - Atualização de Campanhas.png
 * The pixel size comes from the platform format (never from the name).
 */

export const FORMAT_PIXELS: Record<string, [number, number]> = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
  '3:4': [1080, 1440],
  '1.91:1': [1200, 628],
};

export const pixelsLabel = (format: string) => {
  const px = FORMAT_PIXELS[format];
  return px ? `${px[0]}x${px[1]}` : format;
};

export const bannerLabel = (n: number | null | undefined) => (n && n > 0 ? `B${String(n).padStart(2, '0')}` : null);

/** Windows/macOS can't have \ / : * ? " < > | in file names. */
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

export interface NamingInput {
  client: string;
  format: string;
  bannerNumber?: number | null;
  task?: string | null;
  /** Used only when there's no task/banner, so two files never get the same name. */
  id?: string;
}

export function creativeFileName({ client, format, bannerNumber, task, id }: NamingInput): string {
  const banner = bannerLabel(bannerNumber);
  const parts = [`[${clean(client || 'Cliente')}]`, `[${pixelsLabel(format)}]`, banner && `[${banner}]`, task && clean(task)];
  if (!banner && !task && id) parts.push(id.slice(0, 6));
  return `${parts.filter(Boolean).join(' ')}.png`;
}

/**
 * The image at the exact pixel size of its format (center crop + high-quality
 * resampling). Formats without a fixed size keep the original pixels.
 */
export async function imageAtFormatSize(url: string, format: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar a imagem (${res.status})`);
  const blob = await res.blob();
  const px = FORMAT_PIXELS[format];
  const bmp = await createImageBitmap(blob);
  const [w, h] = px ?? [bmp.width, bmp.height];
  const ratio = w / h;
  let sw = bmp.width;
  let sh = bmp.height;
  if (sw / sh > ratio) sw = Math.round(sh * ratio);
  else sh = Math.round(sw / ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, Math.round((bmp.width - sw) / 2), Math.round((bmp.height - sh) / 2), sw, sh, 0, 0, w, h);
  bmp.close();
  // re-encoding also drops any metadata the model embedded in the PNG
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG'))), 'image/png'));
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
