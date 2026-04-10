
-- Create has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission = _permission
      AND rp.enabled = true
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;

-- Update projects INSERT policy to use has_permission
DROP POLICY IF EXISTS "Owner admin manager can create projects" ON public.projects;
CREATE POLICY "Users with create_project permission can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'create_project'));

-- Update projects UPDATE policy
DROP POLICY IF EXISTS "Owner admin manager can update projects" ON public.projects;
CREATE POLICY "Users with edit_project permission can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'edit_project'));

-- Update brand_kits INSERT/UPDATE/DELETE to use has_permission
DROP POLICY IF EXISTS "Owner admin manager can create brand_kits" ON public.brand_kits;
CREATE POLICY "Users with manage_brand_kit can create brand_kits"
ON public.brand_kits
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'manage_brand_kit'));

DROP POLICY IF EXISTS "Owner admin manager can update brand_kits" ON public.brand_kits;
CREATE POLICY "Users with manage_brand_kit can update brand_kits"
ON public.brand_kits
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'manage_brand_kit'));

DROP POLICY IF EXISTS "Owner admin manager can delete brand_kits" ON public.brand_kits;
CREATE POLICY "Users with manage_brand_kit can delete brand_kits"
ON public.brand_kits
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'manage_brand_kit'));

-- Update swipe_files INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Owner admin manager can create swipe_files" ON public.swipe_files;
CREATE POLICY "Users with manage_swipe_files can create swipe_files"
ON public.swipe_files
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'manage_swipe_files'));

DROP POLICY IF EXISTS "Owner admin manager can update swipe_files" ON public.swipe_files;
CREATE POLICY "Users with manage_swipe_files can update swipe_files"
ON public.swipe_files
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'manage_swipe_files'));

DROP POLICY IF EXISTS "Owner admin manager can delete swipe_files" ON public.swipe_files;
CREATE POLICY "Users with manage_swipe_files can delete swipe_files"
ON public.swipe_files
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'manage_swipe_files'));

-- Update generated_creatives DELETE policy
DROP POLICY IF EXISTS "Owner admin manager can delete generated_creatives" ON public.generated_creatives;
CREATE POLICY "Users with delete_creative can delete generated_creatives"
ON public.generated_creatives
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'delete_creative'));
