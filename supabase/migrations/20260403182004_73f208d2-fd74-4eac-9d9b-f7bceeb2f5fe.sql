CREATE TABLE public.user_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creative_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own downloads"
  ON public.user_downloads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all downloads"
  ON public.user_downloads FOR SELECT TO authenticated
  USING (has_any_admin_role(auth.uid()));