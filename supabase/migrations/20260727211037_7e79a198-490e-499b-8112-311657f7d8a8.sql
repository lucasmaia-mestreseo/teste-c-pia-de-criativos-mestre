-- 1. role_permissions: restrict SELECT to admins/owner
DROP POLICY IF EXISTS "Authenticated can view role_permissions" ON public.role_permissions;
CREATE POLICY "Admins can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));

-- 2. Helper: user can access a project (admin, or has explicit access, or is approved with no ACL rows)
CREATE OR REPLACE FUNCTION public.user_can_access_project(_user uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_any_admin_role(_user)
    OR EXISTS (SELECT 1 FROM public.user_project_access WHERE user_id = _user AND project_id = _project)
    OR (
      public.is_approved(_user)
      AND NOT EXISTS (SELECT 1 FROM public.user_project_access WHERE user_id = _user)
    )
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) TO authenticated;

-- 3. Storage: drop ALL existing policies on storage.objects for our buckets
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Helper predicate: extract project id from path and check access
-- Paths are shaped like `{projectId}/{filename}`.
-- SELECT (private buckets): approved user + project access
CREATE POLICY "read own project files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('logos','swipe-files','generated-creatives','brand-photos','people-photos')
    AND public.is_approved(auth.uid())
    AND public.user_can_access_project(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );

-- INSERT policies (permission + project access)
CREATE POLICY "upload logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'logos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "upload brand-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'brand-photos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "upload people-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'people-photos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "upload swipe-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'swipe-files'
    AND public.has_permission(auth.uid(), 'manage_swipe_files')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "upload generated-creatives" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'generated-creatives'
    AND public.is_approved(auth.uid())
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

-- DELETE policies
CREATE POLICY "delete logos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'logos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "delete brand-photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'brand-photos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "delete people-photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'people-photos'
    AND public.has_permission(auth.uid(), 'manage_brand_kit')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "delete swipe-files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'swipe-files'
    AND public.has_permission(auth.uid(), 'manage_swipe_files')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "delete generated-creatives" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'generated-creatives'
    AND public.has_permission(auth.uid(), 'delete_creative')
    AND public.user_can_access_project(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );

-- 4. Revoke EXECUTE from anon on all SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;