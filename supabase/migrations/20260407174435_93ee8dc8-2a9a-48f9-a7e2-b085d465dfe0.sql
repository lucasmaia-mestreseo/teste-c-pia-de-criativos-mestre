
-- Table: role_permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role_permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owner can insert role_permissions"
  ON public.role_permissions FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owner can update role_permissions"
  ON public.role_permissions FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owner can delete role_permissions"
  ON public.role_permissions FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Table: user_project_access
CREATE TABLE public.user_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access or admins see all"
  ON public.user_project_access FOR SELECT
  TO authenticated USING ((auth.uid() = user_id) OR has_any_admin_role(auth.uid()));

CREATE POLICY "Owner admin can insert project access"
  ON public.user_project_access FOR INSERT
  TO authenticated WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Owner admin can update project access"
  ON public.user_project_access FOR UPDATE
  TO authenticated USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Owner admin can delete project access"
  ON public.user_project_access FOR DELETE
  TO authenticated USING (has_any_admin_role(auth.uid()));

-- Seed: all permissions for all roles
DO $$
DECLARE
  perms text[] := ARRAY['create_project','delete_project','edit_project','generate_creative','delete_creative','download_creative','manage_brand_kit','manage_swipe_files','favorite_creative'];
  p text;
BEGIN
  FOREACH p IN ARRAY perms LOOP
    -- Owner: all enabled
    INSERT INTO public.role_permissions (role, permission, enabled) VALUES ('owner', p, true);
    -- Admin: all enabled
    INSERT INTO public.role_permissions (role, permission, enabled) VALUES ('admin', p, true);
    -- Manager: all except delete_project
    INSERT INTO public.role_permissions (role, permission, enabled) VALUES ('manager', p, p <> 'delete_project');
    -- Analyst: only generate, download, favorite
    INSERT INTO public.role_permissions (role, permission, enabled) VALUES ('analyst', p, p IN ('generate_creative','download_creative','favorite_creative'));
  END LOOP;
END $$;
