import type { QueryClient } from '@tanstack/react-query';
import { invokeWithRetry } from '@/lib/invokeWithRetry';

/**
 * Client-side entry points for the post-generation operations:
 * revisão automática (review-creative) and transformações
 * (transform-creative: resize / unfold / fix).
 */

export interface ReviewIssue {
  severity: 'alta' | 'media' | 'baixa';
  category: string;
  description: string;
  fix_instruction: string;
}

export interface CreativeReview {
  approved: boolean;
  score: number;
  summary: string;
  issues: ReviewIssue[];
  model?: string;
  cost_usd?: number;
  reviewed_at?: string;
}

export type TransformOperation = 'resize' | 'unfold' | 'fix';

export interface TransformParams {
  projectId: string;
  operation: TransformOperation;
  targetFormat?: string;
  creativeId?: string;
  sourceImageUrl?: string;
  sourceFormat?: string;
  instructions?: string;
  issues?: string[];
  includeLogo?: boolean;
}

export interface TransformResult {
  creativeId: string;
  imageUrl: string;
  model?: string;
  costUsd?: number;
}

export function invalidateCreatives(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
}

/** Run the automatic review for one creative. Never throws — review is best-effort. */
export async function reviewCreative(qc: QueryClient, projectId: string, creativeId: string): Promise<CreativeReview | null> {
  try {
    invalidateCreatives(qc, projectId); // shows the "revisando" state
    const data = await invokeWithRetry<{ review: CreativeReview }>(
      'review-creative',
      { projectId, creativeId },
      { friendlyName: 'Revisão automática', projectId, maxRetries: 1, silent: true },
    );
    return data.review;
  } catch (e) {
    console.warn('Revisão automática falhou:', e);
    return null;
  } finally {
    invalidateCreatives(qc, projectId);
  }
}

export async function transformCreative(params: TransformParams): Promise<TransformResult> {
  const friendlyName = params.operation === 'fix' ? 'Correção' : params.operation === 'resize' ? 'Redimensionar' : 'Desdobramento';
  return invokeWithRetry<TransformResult>('transform-creative', { ...params }, {
    friendlyName,
    projectId: params.projectId,
    maxRetries: 2,
  });
}

/** Run async tasks with a small concurrency limit (image generation is heavy and rate limited). */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await worker(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export function formatUsd(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `US$ ${Number(value).toFixed(digits)}`;
}

export const KIND_LABELS: Record<string, string> = {
  generate: 'Gerar',
  dynamic: 'Dinâmica',
  resize: 'Redimensionado',
  unfold: 'Desdobramento',
  fix: 'Correção',
};
