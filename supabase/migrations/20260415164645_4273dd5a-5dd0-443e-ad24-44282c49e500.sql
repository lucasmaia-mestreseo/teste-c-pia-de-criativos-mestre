
-- Drop existing INSERT and DELETE policies on storage.objects for all 5 buckets
DROP POLICY IF EXISTS "Approved users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload swipe-files" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete swipe-files" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload brand-photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete brand-photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload people-photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete people-photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload generated-creatives" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can delete generated-creatives" ON storage.objects;

-- Also drop old-named policies that may exist
DROP POLICY IF EXISTS "Project users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can upload swipe files" ON storage.objects;
DROP POLICY IF EXISTS "Project users can delete swipe files" ON storage.objects;
DROP POLICY IF EXISTS "Project users can upload brand photos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can delete brand photos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can upload people photos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can delete people photos" ON storage.objects;
DROP POLICY IF EXISTS "Project users can upload generated creatives" ON storage.objects;
DROP POLICY IF EXISTS "Project users can delete generated creatives" ON storage.objects;

-- Recreate INSERT policies using is_approved
CREATE POLICY "Approved users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can upload swipe-files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'swipe-files' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can upload brand-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-photos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can upload people-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'people-photos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can upload generated-creatives"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-creatives' AND is_approved(auth.uid()));

-- Recreate DELETE policies using is_approved
CREATE POLICY "Approved users can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can delete swipe-files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'swipe-files' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can delete brand-photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-photos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can delete people-photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'people-photos' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can delete generated-creatives"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-creatives' AND is_approved(auth.uid()));
