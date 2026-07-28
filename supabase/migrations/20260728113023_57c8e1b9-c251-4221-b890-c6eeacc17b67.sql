
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user_target(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_assign_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.max_role_rank(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_admin_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_project_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_users(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_user_target(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_assign_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.max_role_rank(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) FROM anon, public;
