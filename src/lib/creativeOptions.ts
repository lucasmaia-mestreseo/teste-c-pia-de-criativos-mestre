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

/** Keeps one creative per option group (the chosen take, else the first) and remembers the others. */
export function collapseOptions<T extends WithMeta>(list: T[]) {
  const groups = new Map<string, T[]>();
  for (const c of list) {
    const g = optionMeta(c).option_group;
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  for (const takes of groups.values()) {
    takes.sort((a, b) => (optionMeta(a).option_index ?? 0) - (optionMeta(b).option_index ?? 0) || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  }
  const seen = new Set<string>();
  const primaries: T[] = [];
  for (const c of list) {
    const g = optionMeta(c).option_group;
    if (!g) { primaries.push(c); continue; }
    if (seen.has(g)) continue;
    seen.add(g);
    const takes = groups.get(g)!;
    primaries.push(takes.find((t) => optionMeta(t).chosen) ?? takes[0]);
  }
  const optionsOf = (c: T): T[] => {
    const g = optionMeta(c).option_group;
    return g ? groups.get(g) ?? [c] : [c];
  };
  return { primaries, optionsOf };
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
