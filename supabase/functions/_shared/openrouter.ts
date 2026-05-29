// Shared OpenRouter helper for all AI Edge Functions.
// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint and supports
// image generation via `modalities: ["image","text"]` on capable models.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ModelSettingsKey = "image_generation" | "text_reasoning" | "vision_analysis";

export interface ModelSettings {
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
}

// Backwards-compat alias
export type ImageGenSettings = ModelSettings & { provider?: string };

const DEFAULTS: Record<ModelSettingsKey, ModelSettings> = {
  image_generation: {
    primary_model: "openai/gpt-5.4-image-2",
    fallback_model: "google/gemini-3.1-flash-image-preview",
    tertiary_model: "x-ai/grok-imagine-image-quality",
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  text_reasoning: {
    primary_model: "google/gemini-3-flash-preview",
    fallback_model: "openai/gpt-5.4-mini",
    tertiary_model: "anthropic/claude-3.5-haiku",
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  vision_analysis: {
    primary_model: "google/gemini-2.5-flash",
    fallback_model: "google/gemini-3-flash-preview",
    tertiary_model: "openai/gpt-5.4-mini",
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
};

export async function loadModelSettings(key: ModelSettingsKey): Promise<ModelSettings> {
  const fallback = DEFAULTS[key];
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, sk);
    const { data } = await client
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (data?.value) {
      return { ...fallback, ...(data.value as Record<string, unknown>) } as ModelSettings;
    }
  } catch (e) {
    console.warn(`loadModelSettings(${key}) fallback to defaults:`, e);
  }
  return fallback;
}

/** @deprecated use loadModelSettings('image_generation') */
export async function loadImageGenSettings(): Promise<ImageGenSettings> {
  return loadModelSettings("image_generation");
}

/** Build the ordered list of (model, level) tuples from settings. */
export function buildModelCascade(s: ModelSettings): Array<{ model: string; level: "primary" | "fallback" | "tertiary" }> {
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
  tools?: unknown[];
  toolChoice?: unknown;
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
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

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
  const direct = msg.images?.[0]?.image_url?.url;
  if (direct) return direct;
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

/** @deprecated use callOpenRouterWithCascade */
export async function callOpenRouterText(model: string, messages: ChatMessage[], responseFormat?: unknown): Promise<CallResult> {
  return callOpenRouter({ model, messages, responseFormat });
}

export interface CascadeOptions {
  settingsKey: ModelSettingsKey;
  messages: ChatMessage[];
  responseFormat?: unknown;
  modalities?: string[];
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
  /** When true, stop on the first 2xx response even if image extraction would fail later. */
  acceptAnyOk?: boolean;
}

export interface CascadeResult extends CallResult {
  modelUsed?: string;
  levelUsed?: "primary" | "fallback" | "tertiary";
  attempts?: number;
}

/**
 * Run the configured cascade for a given settings key. Returns the first
 * successful response, or the last error if every attempt fails. Honors
 * 429 retry-after with a capped wait.
 */
export async function callOpenRouterWithCascade(opts: CascadeOptions): Promise<CascadeResult> {
  const settings = await loadModelSettings(opts.settingsKey);
  const cascade = buildModelCascade(settings);

  let last: CallResult = { ok: false, status: 0, errorBody: "no attempt" };
  let attempts = 0;

  for (const { model, level } of cascade) {
    attempts++;
    const r = await callOpenRouter({
      model,
      messages: opts.messages,
      modalities: opts.modalities,
      responseFormat: opts.responseFormat,
      temperature: opts.temperature,
      tools: opts.tools,
      toolChoice: opts.toolChoice,
    });
    if (r.ok) {
      return { ...r, modelUsed: model, levelUsed: level, attempts };
    }
    last = r;
    console.warn(`[${opts.settingsKey}] ${level} ${model} failed (${r.status}): ${r.errorBody?.slice(0, 200)}`);
    if (r.status === 402) break; // credits exhausted — stop trying
    if (r.status === 429) {
      const ra = r.retryAfter ? parseInt(r.retryAfter, 10) : NaN;
      await new Promise((res) => setTimeout(res, !Number.isNaN(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 1500));
    }
  }
  return { ...last, attempts };
}
