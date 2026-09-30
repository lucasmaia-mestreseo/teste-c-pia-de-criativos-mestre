import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin/owner
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { data: canManage } = await anonClient.rpc("can_manage_users", { _actor: user.id });
    if (!canManage) throw new Error("Sem permissão");

    const { email } = await req.json();
    if (!email || typeof email !== "string") throw new Error("Email é obrigatório");

    const normalizedEmail = email.trim().toLowerCase();
    // Company domains (keep in sync with src/lib/emailDomains.ts)
    const ALLOWED_DOMAINS = ["mestreseo.com.br", "agenciamestre.com"];
    if (!ALLOWED_DOMAINS.includes(normalizedEmail.split("@")[1] ?? "")) {
      throw new Error(`Apenas e-mails ${ALLOWED_DOMAINS.map((d) => "@" + d).join(" ou ")} são permitidos`);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);
    if (inviteError) {
      if (inviteError.message?.includes("already been registered")) {
        throw new Error("Este email já está cadastrado no sistema");
      }
      throw inviteError;
    }

    // Record the invitation
    await adminClient.from("user_invitations").insert({
      email: normalizedEmail,
      invited_by: user.id,
    });

    // Pre-create profile as approved with analyst role
    if (inviteData.user) {
      await adminClient.from("profiles").upsert({
        user_id: inviteData.user.id,
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        approved: true,
      }, { onConflict: "user_id" });

      await adminClient.from("user_roles").upsert({
        user_id: inviteData.user.id,
        role: "analyst",
      }, { onConflict: "user_id,role" });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-user error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao convidar" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
