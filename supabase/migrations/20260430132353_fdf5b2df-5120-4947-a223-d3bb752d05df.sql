ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX IF NOT EXISTS idx_error_logs_status_code ON public.error_logs (status_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON public.error_logs (source);
CREATE INDEX IF NOT EXISTS idx_error_logs_stage ON public.error_logs (stage);