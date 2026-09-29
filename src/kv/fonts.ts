/**
 * Google Fonts helpers for the manual. The css2 API rejects the whole request
 * if you ask for a weight a family doesn't have, so each family is probed from
 * the richest to the simplest axis spec and the first one that loads wins.
 */

const AXES = [
  'ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700',
  'wght@300;400;500;600;700;800',
  'wght@400;600;700',
  'wght@400;700',
  '',
];

const cache = new Map<string, string | null>();

async function probe(family: string): Promise<string | null> {
  if (cache.has(family)) return cache.get(family)!;
  const name = family.trim().replace(/\s+/g, '+');
  for (const axis of AXES) {
    const param = axis ? `${name}:${axis}` : name;
    try {
      const res = await fetch(`https://fonts.googleapis.com/css2?family=${param}&display=swap`);
      if (res.ok) {
        cache.set(family, param);
        return param;
      }
    } catch {
      break; // offline: give up quickly
    }
  }
  cache.set(family, null);
  return null;
}

/** `family=A:...&family=B:...` for the families that exist on Google Fonts (null if none). */
export async function googleFontsQuery(families: string[]): Promise<{ query: string | null; missing: string[] }> {
  const unique = [...new Set(families.map((f) => f.trim()).filter(Boolean))];
  const params: string[] = [];
  const missing: string[] = [];
  for (const f of unique) {
    const p = await probe(f);
    if (p) params.push(`family=${p}`); else missing.push(f);
  }
  return { query: params.length ? params.join('&') : null, missing };
}

/** Load a family in the current document (for previews in the UI). */
export async function loadPreviewFont(family: string): Promise<boolean> {
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return true;
  const p = await probe(family);
  if (!p) return false;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${p}&display=swap`;
  document.head.appendChild(link);
  return true;
}

/**
 * Commercial / system fonts often found in brandbooks → closest free Google
 * Fonts family (the hand-made manuals did the same: "No lugar de Gotham…").
 */
const EQUIVALENTS: [RegExp, string][] = [
  [/^helvetica|^arial|^nimbus sans/i, 'Inter'],
  [/^gotham|^proxima ?nova|^metropolis/i, 'Montserrat'],
  [/^futura|^century gothic|^avant ?garde/i, 'Jost'],
  [/^avenir|^nunito/i, 'Nunito Sans'],
  [/^gill sans|^myriad|^segoe/i, 'Lato'],
  [/^frutiger|^univers|^din\b|^d-din/i, 'Barlow'],
  [/^museo sans|^brandon|^sofia pro/i, 'Figtree'],
  [/^circular|^graphik|^aktiv|^neue haas/i, 'Inter'],
  [/^garamond|^adobe garamond|^sabon/i, 'EB Garamond'],
  [/^times|^georgia|^minion/i, 'Libre Baskerville'],
  [/^bodoni|^didot/i, 'Playfair Display'],
  [/^calibri|^verdana|^tahoma/i, 'Open Sans'],
];

export function googleEquivalent(family: string): string | null {
  const f = family.trim();
  for (const [re, eq] of EQUIVALENTS) if (re.test(f)) return eq;
  return null;
}

/** Popular Google Fonts offered in the font picker (free text is also accepted). */
export const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Raleway', 'Nunito', 'Nunito Sans', 'Work Sans',
  'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Outfit', 'Sora', 'Space Grotesk', 'Rubik', 'Karla', 'Mulish', 'Barlow',
  'Exo 2', 'Kanit', 'Urbanist', 'Figtree', 'Lexend', 'IBM Plex Sans', 'Source Sans 3', 'Noto Sans', 'Quicksand', 'Josefin Sans',
  'Archivo', 'Oswald', 'Bebas Neue', 'Anton', 'Titillium Web', 'Cabin', 'Heebo', 'Hind', 'Libre Franklin', 'Red Hat Display',
  'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'DM Serif Display', 'Fraunces', 'Crimson Pro', 'PT Serif', 'Bitter',
];

export const WEB_SAFE_FONTS = ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Georgia', 'Times New Roman', 'Calibri', 'Arial Black'];
