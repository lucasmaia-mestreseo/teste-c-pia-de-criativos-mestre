import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthedUser {
  userId: string;
  jwt: string;
}

/**
 * Validates the caller's Supabase JWT and returns the user id.
 * Throws Response with 401 if missing/invalid.
 */
export async function requireAuth(req: Request, corsHeaders: Record<string, string>): Promise<AuthedUser | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jwt = authHeader.slice("Bearer ".length);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getClaims(jwt);
  const userId = data?.claims?.sub as string | undefined;
  if (error || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId, jwt };
}

/** Also require the user is approved. */
export async function requireApproved(req: Request, corsHeaders: Record<string, string>): Promise<AuthedUser | Response> {
  const authed = await requireAuth(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: prof } = await admin
    .from("profiles")
    .select("approved")
    .eq("user_id", authed.userId)
    .maybeSingle();
  if (!prof?.approved) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return authed;
}

/** Require the user has access to a specific projectId. */
export async function requireProjectAccess(
  req: Request,
  projectId: string,
  corsHeaders: Record<string, string>,
): Promise<AuthedUser | Response> {
  const authed = await requireApproved(req, corsHeaders);
  if (authed instanceof Response) return authed;
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.rpc("user_can_access_project", {
    _user: authed.userId,
    _project: projectId,
  });
  if (error || data !== true) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return authed;
}
