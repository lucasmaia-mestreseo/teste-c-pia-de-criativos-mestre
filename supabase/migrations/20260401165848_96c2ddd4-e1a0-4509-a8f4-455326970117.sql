
-- 1. PROFILES: restrict SELECT to self + admins
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or admins see all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_any_admin_role(auth.uid())
  );

-- 2. PROFILES: add explicit DELETE policy
CREATE POLICY "Only owner or admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_any_admin_role(auth.uid())
  );

-- 3. USER_ROLES: restrict SELECT to self + admins
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles or admins see all"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR has_any_admin_role(auth.uid())
  );

-- 4. STORAGE: drop public INSERT/DELETE policies and replace with authenticated ones
-- Remove all existing public INSERT and DELETE policies on storage.objects
DROP POLICY IF EXISTS "Give users access to own folder 1ffg0oo_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ffg0oo_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ffg0oo_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 17jk0dc_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 17jk0dc_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 17jk0dc_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 5odsml_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 5odsml_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 5odsml_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1supbsm_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1supbsm_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1supbsm_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder cbp5wq_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder cbp5wq_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder cbp5wq_2" ON storage.objects;

-- Drop any generic public policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (cmd = 'INSERT' OR cmd = 'DELETE')
      AND roles::text[] @> ARRAY['public']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Create authenticated INSERT policies for each bucket
CREATE POLICY "Authenticated upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated upload swipe-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'swipe-files' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated upload generated-creatives"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generated-creatives' AND is_approved(auth.uid()));

CREATE POLICY "Authenticated upload brand-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-photos' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated upload people-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'people-photos' AND has_project_access(auth.uid()));

-- Create authenticated DELETE policies for each bucket
CREATE POLICY "Authenticated delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated delete swipe-files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'swipe-files' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated delete generated-creatives"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'generated-creatives' AND has_any_admin_role(auth.uid()));

CREATE POLICY "Authenticated delete brand-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-photos' AND has_project_access(auth.uid()));

CREATE POLICY "Authenticated delete people-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'people-photos' AND has_project_access(auth.uid()));
