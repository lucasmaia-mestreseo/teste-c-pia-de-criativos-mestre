import { requireApproved } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient } from "../_shared/storage.ts";

/**
 * The caller's own permissions. `role_permissions` is readable only by admins
 * (RLS), so managers and analysts used to see every action disabled in the UI;
 * this returns just the rows of the caller's roles.
 *
 * Returns: { permissions: [{ permission, enabled }] }
 */
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const authed = await requireApproved(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const db = adminClient();
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", authed.userId);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    if (!list.length) return jsonResponse({ permissions: [] });
    const { data } = await db.from("role_permissions").select("role, permission, enabled").in("role", list);
    // a permission is on if any of the caller's roles enables it
    const merged = new Map<string, boolean>();
    for (const r of data ?? []) merged.set(r.permission, (merged.get(r.permission) ?? false) || !!r.enabled);
    return jsonResponse({ permissions: [...merged].map(([permission, enabled]) => ({ permission, enabled })) });
  } catch (e) {
    console.error("my-permissions error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
