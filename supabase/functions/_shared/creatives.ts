// Saving generated_creatives rows in a way that survives a pending migration.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Columns that existed before migration 20260929120000. */
const BASE_COLUMNS = ["project_id", "swipe_file_id", "image_url", "prompt", "format", "created_by"] as const;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42703 = undefined_column (Postgres); PGRST204 = column not in PostgREST schema cache
  return error.code === "42703" || error.code === "PGRST204" || /could not find the '.+' column|column .+ does not exist/i.test(error.message ?? "");
}

/**
 * Insert a creative with all the new tracking columns (kind, cost, review...).
 * If the database has not received the migration yet, retry with only the
 * original columns so generation keeps working — the extras are simply lost.
 */
export async function insertCreative(db: SupabaseClient, row: Record<string, unknown>): Promise<{ id: string | null }> {
  const { data, error } = await db.from("generated_creatives").insert(row).select("id").single();
  if (!error) return { id: data?.id ?? null };
  if (!isMissingColumnError(error)) throw error;

  console.warn("generated_creatives: migration 20260929120000 pendente — salvando só as colunas originais.", error.message);
  const base: Record<string, unknown> = {};
  for (const k of BASE_COLUMNS) if (k in row) base[k] = row[k];
  const retry = await db.from("generated_creatives").insert(base).select("id").single();
  if (retry.error) throw retry.error;
  return { id: retry.data?.id ?? null };
}
