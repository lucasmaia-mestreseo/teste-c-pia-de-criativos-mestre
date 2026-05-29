CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view app_settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert app_settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (has_any_admin_role(auth.uid()));

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES (
  'image_generation',
  '{
    "provider": "openrouter",
    "primary_model": "openai/gpt-5.4-image-2",
    "fallback_model": "google/gemini-3.1-flash-image-preview",
    "tertiary_model": "x-ai/grok-imagine-image-quality",
    "primary_attempts": 2,
    "fallback_attempts": 1,
    "tertiary_attempts": 1
  }'::jsonb
);