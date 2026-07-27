
-- 1) Helper functions

CREATE OR REPLACE FUNCTION public.can_manage_users(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor AND role IN ('owner','admin','manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_project_admin(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor AND role IN ('owner','admin','manager')
  )
$$;

-- Highest privilege of a user (owner > admin > manager > analyst)
CREATE OR REPLACE FUNCTION public.max_role_rank(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(CASE role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'manager' THEN 2
    WHEN 'analyst' THEN 1
    ELSE 0 END), 0)
  FROM public.user_roles WHERE user_id = _user_id
$$;

-- Actor can manage target user profile/roles
CREATE OR REPLACE FUNCTION public.can_manage_user_target(_actor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_actor, 'owner') THEN true
    WHEN public.has_role(_actor, 'admin') THEN NOT public.has_role(_target, 'owner')
    WHEN public.has_role(_actor, 'manager') THEN public.max_role_rank(_target) <= 1
    ELSE false
  END
$$;

-- Actor can assign this role
CREATE OR REPLACE FUNCTION public.can_assign_role(_actor uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_actor, 'owner') THEN true
    WHEN public.has_role(_actor, 'admin') THEN _role IN ('admin','manager','analyst')
    WHEN public.has_role(_actor, 'manager') THEN _role = 'analyst'
    ELSE false
  END
$$;

-- 2) Projects: allow manager to create/edit/delete
DROP POLICY IF EXISTS "Owner admin can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users with create_project permission can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users with edit_project permission can update projects" ON public.projects;

CREATE POLICY "Project admins can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_project_admin(auth.uid()) OR public.has_permission(auth.uid(), 'create_project'));

CREATE POLICY "Project admins can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_project_admin(auth.uid()) OR public.has_permission(auth.uid(), 'edit_project'));

CREATE POLICY "Project admins can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.has_project_admin(auth.uid()));

-- 3) profiles: managers can manage analyst-only targets
DROP POLICY IF EXISTS "Only owner or admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins see all" ON public.profiles;

CREATE POLICY "View own profile or user managers see all"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_manage_users(auth.uid()));

CREATE POLICY "Update own profile or managed target"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.can_manage_user_target(auth.uid(), user_id));

CREATE POLICY "Delete own profile or managed target"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.can_manage_user_target(auth.uid(), user_id));

-- 4) user_roles: gate by target and role level
DROP POLICY IF EXISTS "Owner or admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner or admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner or admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles or admins see all" ON public.user_roles;

CREATE POLICY "View own roles or user managers see all"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_manage_users(auth.uid()));

CREATE POLICY "Insert roles within manager scope"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_user_target(auth.uid(), user_id)
    AND public.can_assign_role(auth.uid(), role)
  );

CREATE POLICY "Update roles within manager scope"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.can_manage_user_target(auth.uid(), user_id))
  WITH CHECK (
    public.can_manage_user_target(auth.uid(), user_id)
    AND public.can_assign_role(auth.uid(), role)
  );

CREATE POLICY "Delete roles within manager scope"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.can_manage_user_target(auth.uid(), user_id)
    AND public.can_assign_role(auth.uid(), role)
  );

-- 5) user_invitations: allow managers
DROP POLICY IF EXISTS "Owner or admin can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Owner or admin can delete invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Owner or admin can view invitations" ON public.user_invitations;

CREATE POLICY "User managers can create invitations"
  ON public.user_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_users(auth.uid()));

CREATE POLICY "User managers can view invitations"
  ON public.user_invitations FOR SELECT TO authenticated
  USING (public.can_manage_users(auth.uid()));

CREATE POLICY "User managers can delete invitations"
  ON public.user_invitations FOR DELETE TO authenticated
  USING (public.can_manage_users(auth.uid()));
