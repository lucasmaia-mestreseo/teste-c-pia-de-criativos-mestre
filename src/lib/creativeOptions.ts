import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Opções: one request can make 1, 2 or 4 takes of the same piece (same prompt,
 * same format, same banner number). The gallery shows one — the chosen take,
 * or the first — and the viewer lets you compare "Opção A / B / C / D".
 * The takes share generation_meta.option_group; the chosen one has chosen = true.
 */

export type OptionCount = 1 | 2 | 4;

export const OPTION_CHOICES: { n: OptionCount; label: string; hint: string; warn?: boolean; recommended?: boolean }[] = [
  { n: 1, label: 'Gerar 1x', hint: 'Uma opção por peça' },
  { n: 2, label: 'Gerar 2x', hint: 'Duas opções para comparar — geralmente uma acerta', recommended: true },
  { n: 4, label: 'Gerar 4x', hint: 'Alerta: alto consumo de créditos', warn: true },
];

interface WithMeta { id: string; created_at?: string; generation_meta?: unknown }

interface OptionMeta { option_group?: string; option_index?: number; chosen?: boolean }
export const optionMeta = (c: WithMeta): OptionMeta => ((c.generation_meta ?? {}) as OptionMeta);

export const optionLetter = (i: number) => String.fromCharCode(65 + i); // 0 → A

const byOptionGroup = (c: WithMeta) => optionMeta(c).option_group;

/**
 * Keeps one creative per group (the chosen take, else the first) and remembers the others.
 * By default a group is one "Gerar 2x/4x" round; `keyOf` can group wider (Desdobramento:
 * every version of the same piece-mãe in the same format is an option of the others).
 * Order inside a group: newest round first, then A, B, C…
 */
export function collapseOptions<T extends WithMeta>(list: T[], keyOf: (c: T) => string | undefined = byOptionGroup) {
  const groups = new Map<string, T[]>();
  for (const c of list) {
    const g = keyOf(c);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  const roundOf = (c: WithMeta) => optionMeta(c).option_group ?? c.id;
  for (const takes of groups.values()) {
    const start = new Map<string, string>();
    for (const t of takes) {
      const r = roundOf(t);
      const at = t.created_at ?? '';
      if (!start.has(r) || at < start.get(r)!) start.set(r, at);
    }
    takes.sort((a, b) =>
      (start.get(roundOf(b)) ?? '').localeCompare(start.get(roundOf(a)) ?? '')
      || (optionMeta(a).option_index ?? 0) - (optionMeta(b).option_index ?? 0)
      || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  }
  const seen = new Set<string>();
  const primaries: T[] = [];
  for (const c of list) {
    const g = keyOf(c);
    if (!g) { primaries.push(c); continue; }
    if (seen.has(g)) continue;
    seen.add(g);
    const takes = groups.get(g)!;
    primaries.push(takes.find((t) => optionMeta(t).chosen) ?? takes[0]);
  }
  const optionsOf = (c: T): T[] => {
    const g = keyOf(c);
    return g ? groups.get(g) ?? [c] : [c];
  };
  return { primaries, optionsOf };
}

/**
 * Marks a new creative as an option of its round from the browser too, so grouping
 * works even while the server functions are an older version.
 */
export async function tagOption(id: string, group: string, index: number, bannerNumber?: number | null) {
  try {
    const { data } = await supabase.from('generated_creatives').select('generation_meta').eq('id', id).maybeSingle();
    const meta = { ...((data?.generation_meta as Record<string, unknown> | null) ?? {}), option_group: group, option_index: index };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any = { generation_meta: meta };
    if (bannerNumber) patch.banner_number = bannerNumber;
    await supabase.from('generated_creatives').update(patch).eq('id', id);
  } catch { /* the server already stores it when up to date */ }
}

/** Marks one take as the chosen option of its group (the one shown, downloaded and fixed). */
export async function chooseOption(qc: QueryClient, projectId: string, takes: WithMeta[], chosenId: string) {
  for (const t of takes) {
    const meta = { ...(t.generation_meta as Record<string, unknown> ?? {}), chosen: t.id === chosenId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('generated_creatives').update({ generation_meta: meta } as any).eq('id', t.id);
    if (error) throw error;
  }
  qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
}

const COUNT_KEY = (where: string) => `cm-option-count:${where}`;
/** Last choice per tool (Gerar / Desdobramento); 2x until the person picks another. */
export function readOptionCount(where: string): OptionCount {
  try {
    const n = Number(localStorage.getItem(COUNT_KEY(where)));
    return n === 1 || n === 2 || n === 4 ? n : 2;
  } catch { return 2; }
}
export function writeOptionCount(where: string, n: OptionCount) {
  try { localStorage.setItem(COUNT_KEY(where), String(n)); } catch { /* private mode: back to 2x next time */ }
}
export const newOptionGroup = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
