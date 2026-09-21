INSERT INTO public.app_settings (key, value)
VALUES (
  'model_catalogs',
  '{
    "image_generation": [
      "openai/gpt-5.4-image-2",
      "openai/gpt-5-image",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
      "google/gemini-2.5-flash-image",
      "x-ai/grok-imagine-image-quality",
      "x-ai/grok-imagine-image",
      "black-forest-labs/flux-1.1-pro",
      "black-forest-labs/flux-pro"
    ],
    "text_reasoning": [
      "google/gemini-3-flash-preview",
      "google/gemini-3.1-flash-lite-preview",
      "google/gemini-3.5-flash",
      "google/gemini-3.1-pro-preview",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5.4",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.4-nano",
      "openai/gpt-5.5",
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-sonnet-4",
      "x-ai/grok-2-1212",
      "x-ai/grok-4"
    ],
    "vision_analysis": [
      "google/gemini-3-flash-preview",
      "google/gemini-3.5-flash",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5.4",
      "openai/gpt-5.4-mini",
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-sonnet-4"
    ],
    "synced_at": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;