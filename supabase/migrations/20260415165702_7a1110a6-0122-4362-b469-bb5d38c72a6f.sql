
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  function_name text NOT NULL,
  error_message text,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view error logs"
ON public.error_logs FOR SELECT TO authenticated
USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Authenticated users can insert error logs"
ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_function ON public.error_logs (function_name);
