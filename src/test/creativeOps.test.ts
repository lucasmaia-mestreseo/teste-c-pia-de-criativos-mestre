import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/invokeWithRetry', () => ({ invokeWithRetry: vi.fn() }));

import { formatUsd, runWithConcurrency } from '@/lib/creativeOps';

describe('runWithConcurrency', () => {
  it('never runs more than `limit` tasks at once and keeps result order', async () => {
    let running = 0;
    let peak = 0;
    const results = await runWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i;
    });
    expect(peak).toBe(2);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([0, 1, 2, 3, 4]);
  });

  it('isolates failures: one rejected task does not stop the others', async () => {
    const results = await runWithConcurrency(['ok', 'boom', 'ok'], 2, async (x) => {
      if (x === 'boom') throw new Error('falhou');
      return x;
    });
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });

  it('handles an empty list', async () => {
    expect(await runWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});

describe('formatUsd', () => {
  it('formats numbers and shows a dash for missing values', () => {
    expect(formatUsd(0.04)).toBe('US$ 0.040');
    expect(formatUsd(1.5, 2)).toBe('US$ 1.50');
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(undefined)).toBe('—');
  });
});
