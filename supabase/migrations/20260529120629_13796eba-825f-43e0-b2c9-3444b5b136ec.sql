INSERT INTO app_settings (key, value)
VALUES
  ('text_reasoning', '{"primary_model":"google/gemini-3-flash-preview","fallback_model":"openai/gpt-5.4-mini","tertiary_model":"anthropic/claude-3.5-haiku","primary_attempts":2,"fallback_attempts":1,"tertiary_attempts":1}'::jsonb),
  ('vision_analysis', '{"primary_model":"google/gemini-2.5-flash","fallback_model":"google/gemini-3-flash-preview","tertiary_model":"openai/gpt-5.4-mini","primary_attempts":2,"fallback_attempts":1,"tertiary_attempts":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;