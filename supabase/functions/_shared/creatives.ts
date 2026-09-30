// Saving generated_creatives rows in a way that survives a pending migration.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Columns that existed before migration 20260929003555 (redimensionar/custos/revisão). */
const BASE_COLUMNS = ["project_id", "swipe_file_id", "image_url", "prompt", "format", "created_by"] as const;
/** Columns of the Tarefas migration (20261001120000). */
const TASK_COLUMNS = ["task_id", "banner_number"] as const;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42703 = undefined_column (Postgres); PGRST204 = column not in PostgREST schema cache
  return error.code === "42703" || error.code === "PGRST204" || /could not find the '.+' column|column .+ does not exist/i.test(error.message ?? "");
}

/** The task only counts if it belongs to this project (never trust the id from the browser). */
export async function resolveTaskId(db: SupabaseClient, projectId: string, taskId: unknown): Promise<string | null> {
  if (typeof taskId !== "string" || !taskId) return null;
  const { data, error } = await db.from("project_tasks").select("id, project_id").eq("id", taskId).maybeSingle();
  if (error || !data || data.project_id !== projectId) return null;
  return data.id;
}

/** Next banner number of a task (B01, B02…). */
export async function nextBannerNumber(db: SupabaseClient, taskId: string): Promise<number> {
  const { data } = await db
    .from("generated_creatives")
    .select("banner_number")
    .eq("task_id", taskId)
    .not("banner_number", "is", null)
    .order("banner_number", { ascending: false })
    .limit(1);
  return (data?.[0]?.banner_number ?? 0) + 1;
}

/**
 * Insert a creative with all the tracking columns (kind, cost, review, task…).
 * A piece in a task without a banner number gets the next one. If the database
 * hasn't received a migration yet, retry without the missing columns so
 * generation keeps working — the extras are simply lost.
 */
export async function insertCreative(db: SupabaseClient, row: Record<string, unknown>): Promise<{ id: string | null; bannerNumber: number | null }> {
  const full = { ...row };
  if (full.task_id && full.banner_number == null) {
    try { full.banner_number = await nextBannerNumber(db, String(full.task_id)); } catch { /* column missing: handled below */ }
  }
  const { data, error } = await db.from("generated_creatives").insert(full).select("id").single();
  if (!error) return { id: data?.id ?? null, bannerNumber: (full.banner_number as number | undefined) ?? null };
  if (!isMissingColumnError(error)) throw error;

  // 1st fallback: only the Tarefas migration is missing
  const noTask: Record<string, unknown> = { ...row };
  for (const k of TASK_COLUMNS) delete noTask[k];
  const r1 = await db.from("generated_creatives").insert(noTask).select("id").single();
  if (!r1.error) {
    console.warn("generated_creatives: migration de Tarefas pendente — peça salva sem tarefa.", error.message);
    return { id: r1.data?.id ?? null, bannerNumber: null };
  }
  if (!isMissingColumnError(r1.error)) throw r1.error;

  // 2nd fallback: the database is older than migration 20260929003555
  console.warn("generated_creatives: migration 20260929003555 pendente — salvando só as colunas originais.", r1.error.message);
  const base: Record<string, unknown> = {};
  for (const k of BASE_COLUMNS) if (k in row) base[k] = row[k];
  const retry = await db.from("generated_creatives").insert(base).select("id").single();
  if (retry.error) throw retry.error;
  return { id: retry.data?.id ?? null, bannerNumber: null };
}
