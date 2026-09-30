import { describe, it, expect } from 'vitest';
import { collapseOptions } from '@/lib/creativeOptions';

const take = (id: string, group?: string, index?: number, chosen?: boolean) => ({
  id, created_at: `2026-10-01T10:00:0${id.length}Z`,
  generation_meta: group ? { option_group: group, option_index: index, ...(chosen !== undefined ? { chosen } : {}) } : {},
});

describe('opções (Gerar 2x / 4x)', () => {
  it('shows one piece per option group, opção A by default', () => {
    const list = [take('b', 'g1', 1), take('a', 'g1', 0), take('solo')];
    const { primaries, optionsOf } = collapseOptions(list);
    expect(primaries.map((c) => c.id)).toEqual(['a', 'solo']);
    expect(optionsOf(primaries[0]).map((c) => c.id)).toEqual(['a', 'b']);
    expect(optionsOf(primaries[1]).map((c) => c.id)).toEqual(['solo']);
  });

  it('shows the chosen option in the gallery', () => {
    const list = [take('a', 'g1', 0, false), take('b', 'g1', 1, true), take('c', 'g1', 2)];
    const { primaries } = collapseOptions(list);
    expect(primaries.map((c) => c.id)).toEqual(['b']);
  });

  it('finds the group from any of its options', () => {
    const list = [take('a', 'g1', 0), take('b', 'g1', 1)];
    const { optionsOf } = collapseOptions(list);
    expect(optionsOf(list[1]).map((c) => c.id)).toEqual(['a', 'b']);
  });
});
