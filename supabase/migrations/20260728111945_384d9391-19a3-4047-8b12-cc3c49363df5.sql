
-- 1) template_prompts: require approved
DROP POLICY IF EXISTS "Authenticated users can view template prompts" ON public.template_prompts;
CREATE POLICY "Approved users can view template prompts"
  ON public.template_prompts
  FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- 2) Revoke EXECUTE from authenticated & PUBLIC & anon on SECURITY DEFINER helpers.
-- These are still callable from RLS policies (evaluated by table owner) and from
-- edge functions using the service role key.
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_admin_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_users(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_project_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.max_role_rank(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_assign_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_user_target(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
