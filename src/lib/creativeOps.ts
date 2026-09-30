import type { QueryClient } from '@tanstack/react-query';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import { getCurrentTaskId } from '@/hooks/useTasks';
import { tagOption } from '@/lib/creativeOptions';

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

export type TransformOperation = 'resize' | 'unfold' | 'fix' | 'variant';

/** One A/B variation proposed by suggest-variants (editable before generating). */
export interface VariantProposal {
  nome: string;
  hipotese: string;
  headline: string;
  cta: string;
  ajusteVisual: string;
}

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
  variant?: VariantProposal;
  /** Tarefa (defaults to the one selected in the project) and banner number (Desdobramento keeps the Bxx of its piece). */
  taskId?: string;
  bannerNumber?: number;
  /** width / height of the piece-mãe (chooses outpainting vs. recomposition). */
  sourceRatio?: number;
  /** Gerar 2x/4x: takes of one version share a group; index 0 = opção A. */
  optionGroup?: string;
  optionIndex?: number;
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
  const friendlyName = { fix: 'Correção', resize: 'Redimensionar', unfold: 'Desdobramento', variant: 'Variação A/B' }[params.operation];
  // the task being worked on; the server keeps resize/fix/variant in the task of their piece
  const taskId = params.taskId ?? getCurrentTaskId(params.projectId) ?? undefined;
  const result = await invokeWithRetry<TransformResult>('transform-creative', { ...params, taskId }, {
    friendlyName,
    projectId: params.projectId,
    maxRetries: 2,
  });
  if (params.optionGroup && result?.creativeId) await tagOption(result.creativeId, params.optionGroup, params.optionIndex ?? 0, params.bannerNumber);
  return result;
}

export async function suggestVariants(projectId: string, creativeId: string, quantidade: number, foco: string) {
  return invokeWithRetry<{ textosAtuais: { headline: string; cta: string }; variacoes: VariantProposal[] }>(
    'suggest-variants', { projectId, creativeId, quantidade, foco }, { friendlyName: 'Sugestão de variações', projectId, maxRetries: 1 },
  );
}

/* ─── Copy do anúncio ─── */

export interface AdCopy {
  meta: { textoPrincipal: string; titulo: string; descricao: string; botao: string };
  instagram: { legenda: string; hashtags: string[] };
  linkedin: { texto: string };
  google: { titulos: string[]; descricoes: string[] };
  variacoes: { angulo: string; textoPrincipal: string; titulo: string }[];
  objetivo?: string;
  geradoEm?: string;
}

export async function generateAdCopy(projectId: string, creativeId: string, objetivo: string, observacoes?: string) {
  return invokeWithRetry<{ adCopy: AdCopy }>('ad-copy', { projectId, creativeId, objetivo, observacoes }, {
    friendlyName: 'Copy do anúncio', projectId, maxRetries: 1,
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
  variant: 'Variação A/B',
};

/** Display origin: variants keep kind "generate" and are marked in generation_meta. */
export function originOf(c: { kind?: string | null; generation_meta?: unknown }): string {
  const op = (c.generation_meta as { operation?: string } | null)?.operation;
  if (op === 'variant') return 'variant';
  return c.kind ?? 'generate';
}
