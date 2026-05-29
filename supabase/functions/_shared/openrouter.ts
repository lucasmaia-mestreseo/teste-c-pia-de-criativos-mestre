// Shared OpenRouter helper for all AI Edge Functions.
// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint and supports
// image generation via `modalities: ["image","text"]` on capable models.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ImageGenSettings {
  provider: "openrouter";
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
}

const DEFAULT_IMAGE_SETTINGS: ImageGenSettings = {
  provider: "openrouter",
  primary_model: "openai/gpt-5.4-image-2",
  fallback_model: "google/gemini-3.1-flash-image-preview",
  tertiary_model: "x-ai/grok-imagine-image-quality",
  primary_attempts: 2,
  fallback_attempts: 1,
  tertiary_attempts: 1,
};

export async function loadImageGenSettings(): Promise<ImageGenSettings> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, key);
    const { data } = await client
      .from("app_settings")
      .select("value")
      .eq("key", "image_generation")
      .maybeSingle();
    if (data?.value) {
      return { ...DEFAULT_IMAGE_SETTINGS, ...(data.value as Record<string, unknown>) } as ImageGenSettings;
    }
  } catch (e) {
    console.warn("loadImageGenSettings fallback to defaults:", e);
  }
  return DEFAULT_IMAGE_SETTINGS;
}

/** Build the ordered list of (model, max_attempts) tuples from settings. */
export function buildModelCascade(s: ImageGenSettings): Array<{ model: string; level: "primary" | "fallback" | "tertiary" }> {
  const out: Array<{ model: string; level: "primary" | "fallback" | "tertiary" }> = [];
  for (let i = 0; i < Math.max(1, s.primary_attempts); i++) out.push({ model: s.primary_model, level: "primary" });
  for (let i = 0; i < Math.max(0, s.fallback_attempts); i++) out.push({ model: s.fallback_model, level: "fallback" });
  for (let i = 0; i < Math.max(0, s.tertiary_attempts); i++) out.push({ model: s.tertiary_model, level: "tertiary" });
  return out;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: unknown;
}

export interface CallOptions {
  model: string;
  messages: ChatMessage[];
  modalities?: string[];
  responseFormat?: unknown;
  temperature?: number;
}

export interface CallResult {
  ok: boolean;
  status: number;
  data?: any;
  errorBody?: string;
  requestId?: string | null;
  retryAfter?: string | null;
}

export async function callOpenRouter(opts: CallOptions): Promise<CallResult> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) {
    return { ok: false, status: 0, errorBody: "OPENROUTER_API_KEY not configured" };
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };
  if (opts.modalities) body.modalities = opts.modalities;
  if (opts.responseFormat) body.response_format = opts.responseFormat;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://criativos.agenciamestre.com",
        "X-Title": "Criativos Mestre",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, errorBody: String(e) };
  }

  const requestId = res.headers.get("x-request-id") || res.headers.get("x-correlation-id");
  const retryAfter = res.headers.get("retry-after");

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, errorBody: text.slice(0, 2000), requestId, retryAfter };
  }
  const data = await res.json();
  return { ok: true, status: res.status, data, requestId, retryAfter };
}

/** Extract a base64 image data-URL or remote URL from an OpenRouter chat-completion response. */
export function extractImageUrl(data: any): string | undefined {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return undefined;
  // 1. OpenRouter image format
  const direct = msg.images?.[0]?.image_url?.url;
  if (direct) return direct;
  // 2. Inline content parts
  const parts = msg.content;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if ((part.type === "image_url" || part.type === "image") && part.image_url?.url) return part.image_url.url;
      if (part.inline_data?.data) return `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
      if (part.type === "output_image" && part.image_url) return part.image_url;
    }
  }
  return undefined;
}

/** Convenience helper for text-only chat completions. */
export async function callOpenRouterText(model: string, messages: ChatMessage[], responseFormat?: unknown): Promise<CallResult> {
  return callOpenRouter({ model, messages, responseFormat });
}
