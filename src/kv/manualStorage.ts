/**
 * Criação de KVs — saving manuals and wiring them into the client's identity.
 *
 * Manuals are stored as self-contained HTML (assets inlined) plus the JSON spec
 * in the project's storage folder: generated-creatives/{projectId}/manuals/.
 * No extra table is needed; the folder listing is the index.
 */
import { supabase } from '@/integrations/supabase/client';
import type { ManualSpec } from './spec';
import { buildTokens } from './fillTemplate';

const BUCKET = 'generated-creatives';
const folder = (projectId: string) => `${projectId}/manuals`;

export interface SavedManual {
  name: string; // file base name (without extension)
  createdAt: string;
  htmlPath: string;
  specPath: string;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'manual';

export async function saveManual(projectId: string, spec: ManualSpec, html: string): Promise<SavedManual> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${slug(spec.marca)}-${stamp}`;
  const htmlPath = `${folder(projectId)}/${base}.html`;
  const specPath = `${folder(projectId)}/${base}.json`;
  const up1 = await supabase.storage.from(BUCKET).upload(htmlPath, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: true });
  if (up1.error) throw up1.error;
  const up2 = await supabase.storage.from(BUCKET).upload(specPath, new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
  if (up2.error) throw up2.error;
  return { name: base, createdAt: new Date().toISOString(), htmlPath, specPath };
}

export async function listManuals(projectId: string): Promise<SavedManual[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder(projectId), { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.name.endsWith('.html'))
    .map((f) => {
      const base = f.name.replace(/\.html$/, '');
      return {
        name: base,
        createdAt: (f as { created_at?: string }).created_at ?? '',
        htmlPath: `${folder(projectId)}/${base}.html`,
        specPath: `${folder(projectId)}/${base}.json`,
      };
    });
}

export async function downloadText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('Arquivo não encontrado');
  return data.text();
}

export async function deleteManual(m: SavedManual): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([m.htmlPath, m.specPath]);
  if (error) throw error;
}

/** "calhas-kennedy-2026-09-29T..." → "calhas kennedy" + date. */
export function manualLabel(m: SavedManual): { brand: string; date: string } {
  const match = m.name.match(/^(.*)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
  if (!match) return { brand: m.name, date: '' };
  const [, b, d, hh, mm] = match;
  const [y, mo, da] = d.split('-');
  return { brand: b.replace(/-/g, ' '), date: `${da}/${mo}/${y} ${hh}:${mm}` };
}

/* ─── integration with the project's identity ─── */

export interface ApplyOptions {
  colors: boolean;
  typography: boolean;
  logoDataUrl: string | null;
  photos: string[]; // JPEG data URLs
  voice: boolean;
  /** Visual rules (colors, CTA, imagery) into the project context used by every generation. */
  guidelines?: boolean;
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/**
 * Push the approved manual into the project: Brand Kit (colors, typography,
 * logo, photos) and Contexto (tone of voice + audience). Everything the
 * creative generator already uses, so new creatives follow the manual.
 */
export async function applyToProject(projectId: string, spec: ManualSpec, opts: ApplyOptions): Promise<string[]> {
  const done: string[] = [];
  const tk = buildTokens(spec);
  const { data: kit } = await supabase.from('brand_kits').select('*').eq('project_id', projectId).maybeSingle();
  const patch: Record<string, unknown> = { project_id: projectId };

  if (opts.colors) {
    patch.primary_color = tk.brand900;
    patch.secondary_color = tk.brand600;
    patch.background_color = tk.brand050;
    const extras = spec.cores.paleta.map((c) => c.hex.toUpperCase()).filter((h) => ![tk.brand900, tk.brand600, tk.brand050].includes(h));
    patch.aux_colors = [...new Set([tk.accent700, ...extras])].slice(0, 6);
    done.push('cores');
  }
  if (opts.typography) {
    patch.typography = spec.tipografia.secundaria && spec.tipografia.secundaria !== spec.tipografia.primaria
      ? `${spec.tipografia.primaria}, ${spec.tipografia.secundaria}`
      : spec.tipografia.primaria;
    done.push('tipografia');
  }
  if (opts.logoDataUrl) {
    const blob = await dataUrlToBlob(opts.logoDataUrl);
    const ext = blob.type.includes('svg') ? 'svg' : 'png';
    const path = `${projectId}/logo-manual-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) throw error;
    patch.logo_url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
    done.push('logo');
  }
  if (opts.photos.length) {
    const urls: string[] = [];
    for (const [i, p] of opts.photos.entries()) {
      const path = `${projectId}/manual-foto-${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage.from('brand-photos').upload(path, await dataUrlToBlob(p), { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      urls.push(supabase.storage.from('brand-photos').getPublicUrl(path).data.publicUrl);
    }
    patch.photos = [...((kit?.photos as string[] | null) ?? []), ...urls];
    done.push(`${urls.length} foto(s)`);
  }
  if (Object.keys(patch).length > 1) {
    const { error } = await supabase.from('brand_kits').upsert(patch as never, { onConflict: 'project_id' });
    if (error) throw error;
  }

  if (opts.voice || opts.guidelines) {
    const { data: project } = await supabase.from('projects').select('context, voice_guide').eq('id', projectId).maybeSingle();
    const upd: { voice_guide?: string; context?: string } = {};
    if (opts.voice) {
      const voice = [spec.resumo.tomDeVoz, spec.resumo.publico && `Público: ${spec.resumo.publico}`].filter(Boolean).join('\n\n');
      if (voice) upd.voice_guide = project?.voice_guide ? `${project.voice_guide}\n\n— Do manual de marca —\n${voice}` : voice;
      if (voice) done.push('tom de voz');
    }
    if (opts.guidelines) {
      // Previous guidelines block is replaced, not duplicated, when a manual is applied again.
      const base = (project?.context ?? '').replace(/\n*— Diretrizes do manual de marca —[\s\S]*$/, '').trim();
      const intro = base || [`${spec.marca}: ${spec.posicionamento}`, spec.textoDeApoio].filter(Boolean).join('\n');
      upd.context = `${intro}\n\n${manualGuidelines(spec)}`;
      done.push('diretrizes visuais');
    }
    if (Object.keys(upd).length) {
      const { error } = await supabase.from('projects').update(upd).eq('id', projectId);
      if (error) throw error;
    }
  }
  return done;
}

/**
 * The manual's rules in a compact form for the image prompts (the project
 * context is injected into every generation, truncated at ~2500 chars).
 */
export function manualGuidelines(spec: ManualSpec): string {
  const tk = buildTokens(spec);
  const ink = tk.ctaInk === '#FFFFFF' ? 'texto branco' : `texto escuro ${tk.ctaInk}`;
  const lines = [
    '— Diretrizes do manual de marca —',
    spec.resumo.direcaoVisual && `Direção visual: ${spec.resumo.direcaoVisual}`,
    `Cores: ${spec.cores.principal.nome} ${tk.brand900} domina; ${spec.cores.apoio.nome} ${tk.brand600} apoia; ${spec.cores.acento.nome} ${tk.accent700} só em CTA e destaques.${spec.cores.nota ? ` ${spec.cores.nota}` : ''}`,
    `CTA: fundo ${tk.accent700} com ${ink}, caixa alta, ex.: "${spec.cta.principal}".`,
    `Tipografia: ${spec.tipografia.primaria}${spec.tipografia.secundaria && spec.tipografia.secundaria !== spec.tipografia.primaria ? ` e ${spec.tipografia.secundaria}` : ''}.`,
    spec.imagens.fazer.length && `Imagens — fazer: ${spec.imagens.fazer.join('; ')}.`,
    spec.imagens.naoFazer.length && `Imagens — evitar: ${spec.imagens.naoFazer.join('; ')}.`,
  ].filter(Boolean) as string[];
  return lines.join('\n');
}
