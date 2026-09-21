CREATE TABLE public.creative_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.creative_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active formats"
ON public.creative_formats FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert formats"
ON public.creative_formats FOR INSERT TO authenticated
WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can update formats"
ON public.creative_formats FOR UPDATE TO authenticated
USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can delete formats"
ON public.creative_formats FOR DELETE TO authenticated
USING (has_any_admin_role(auth.uid()));

INSERT INTO public.creative_formats (label, sort_order) VALUES
  ('9:16', 1),
  ('4:5', 2),
  ('1:1', 3),
  ('16:9', 4);