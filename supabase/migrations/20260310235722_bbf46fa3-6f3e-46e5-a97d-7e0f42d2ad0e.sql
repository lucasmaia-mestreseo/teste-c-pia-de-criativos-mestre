ALTER TABLE public.swipe_files ADD COLUMN analysis jsonb DEFAULT NULL;

-- Allow updates on swipe_files (needed to save analysis)
CREATE POLICY "Anyone can update swipe_files" ON public.swipe_files FOR UPDATE TO public USING (true) WITH CHECK (true);