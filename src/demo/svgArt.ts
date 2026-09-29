/**
 * MODO DEMO — placeholder artwork. Builds simple "ad" images as SVG data URLs
 * so the demo can show creatives in any format without calling an AI.
 */

const DIMENSIONS: Record<string, [number, number]> = {
  '9:16': [540, 960],
  '4:5': [640, 800],
  '1:1': [720, 720],
  '16:9': [960, 540],
};

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}

/** Split a headline into at most 3 lines of ~maxChars. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export interface AdArtOptions {
  format: string;
  title: string;
  cta?: string;
  primary?: string;
  secondary?: string;
  background?: string;
  /** Small tag in the corner, e.g. "Redimensionado" */
  badge?: string;
  /** Deterministic variation (0..n) */
  variant?: number;
}

export function adArt(o: AdArtOptions): string {
  const [w, h] = DIMENSIONS[o.format] ?? DIMENSIONS['1:1'];
  const primary = o.primary ?? '#FFF95A';
  const secondary = o.secondary ?? '#111111';
  const bg = o.background ?? '#1C1C1C';
  const v = o.variant ?? 0;
  const landscape = w > h;
  const pad = Math.round(Math.min(w, h) * 0.07);
  const fontSize = Math.round(Math.min(w, h) * (landscape ? 0.075 : 0.085));
  const lines = wrap(o.title, landscape ? 16 : 14);

  // Hero shape: circle "photo" placeholder
  const heroR = Math.round(Math.min(w, h) * (landscape ? 0.3 : 0.24));
  const heroX = landscape ? Math.round(w * 0.72) : Math.round(w / 2);
  const heroY = landscape ? Math.round(h / 2) : Math.round(h * 0.56);

  const textX = pad;
  const textY = landscape ? Math.round(h * 0.3) : pad + fontSize + Math.round(h * 0.03);
  const ctaW = Math.round(Math.min(w, h) * 0.42);
  const ctaH = Math.round(fontSize * 1.25);
  const ctaY = landscape ? textY + lines.length * fontSize * 1.15 + pad * 0.6 : h - pad - ctaH - Math.round(h * 0.06);
  const ctaX = landscape ? textX : Math.round((w - ctaW) / 2);

  const shapes = [
    `<circle cx="${heroX}" cy="${heroY}" r="${heroR}" fill="${primary}" opacity="0.18"/>`,
    `<circle cx="${heroX}" cy="${heroY}" r="${Math.round(heroR * 0.72)}" fill="#3a3a3a"/>`,
    `<circle cx="${heroX}" cy="${heroY - heroR * 0.18}" r="${Math.round(heroR * 0.22)}" fill="#5a5a5a"/>`,
    `<path d="M ${heroX - heroR * 0.42} ${heroY + heroR * 0.5} Q ${heroX} ${heroY + heroR * 0.05} ${heroX + heroR * 0.42} ${heroY + heroR * 0.5} Z" fill="#5a5a5a"/>`,
  ];
  if (v % 2 === 1) shapes.push(`<rect x="0" y="${h - Math.round(h * 0.04)}" width="${w}" height="${Math.round(h * 0.04)}" fill="${primary}"/>`);

  const text = lines
    .map((l, i) => `<text x="${textX}" y="${textY + i * fontSize * 1.15}" font-family="Space Grotesk, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${i === 0 ? primary : '#F2F2F2'}">${escapeXml(l)}</text>`)
    .join('');

  const badge = o.badge
    ? `<rect x="${w - pad - 190}" y="${pad * 0.6}" width="190" height="34" rx="17" fill="#000" opacity="0.55"/><text x="${w - pad - 95}" y="${pad * 0.6 + 23}" text-anchor="middle" font-family="Inter, Arial" font-size="16" fill="#fff">${escapeXml(o.badge)}</text>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
${shapes.join('')}
${text}
<rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaH / 2}" fill="${primary}"/>
<text x="${ctaX + ctaW / 2}" y="${ctaY + ctaH * 0.66}" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="${Math.round(fontSize * 0.5)}" fill="${secondary}">${escapeXml(o.cta ?? 'Saiba mais')}</text>
<text x="${w - pad}" y="${h - pad * 0.45}" text-anchor="end" font-family="Inter, Arial" font-size="${Math.round(fontSize * 0.32)}" fill="#8a8a8a">⚡ exemplo · modo demo</text>
${badge}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Simple logo mark for demo brand kits. */
export function logoArt(initials: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="48" fill="${color}"/><text x="120" y="150" text-anchor="middle" font-family="Space Grotesk, Arial" font-weight="700" font-size="96" fill="#111">${escapeXml(initials)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
