-- Allow admins full access to the 5 managed buckets (needed for template-base uploads etc.)
CREATE POLICY "admins read managed buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('logos','swipe-files','generated-creatives','brand-photos','people-photos')
    AND public.has_any_admin_role(auth.uid())
  );

CREATE POLICY "admins insert managed buckets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('logos','swipe-files','generated-creatives','brand-photos','people-photos')
    AND public.has_any_admin_role(auth.uid())
  );

CREATE POLICY "admins update managed buckets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('logos','swipe-files','generated-creatives','brand-photos','people-photos')
    AND public.has_any_admin_role(auth.uid())
  );

CREATE POLICY "admins delete managed buckets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('logos','swipe-files','generated-creatives','brand-photos','people-photos')
    AND public.has_any_admin_role(auth.uid())
  );