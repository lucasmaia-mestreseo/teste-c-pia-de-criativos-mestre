
ALTER TABLE public.brand_kits
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS aux_colors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS people_photos text[] DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('people-photos', 'people-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read people-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'people-photos');

CREATE POLICY "Auth upload people-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'people-photos');

CREATE POLICY "Auth delete people-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'people-photos');
