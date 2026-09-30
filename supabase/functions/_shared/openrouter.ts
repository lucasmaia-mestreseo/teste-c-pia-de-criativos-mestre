// Shared OpenRouter helper for all AI Edge Functions.
// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint and supports
// image generation via `modalities: ["image","text"]` on capable models.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ModelSettingsKey = "image_generation" | "image_unfold" | "text_reasoning" | "vision_analysis" | "brand_manual";

export interface ModelSettings {
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
  /** Image models only: output resolution sent as image_config.image_size ("1K" | "2K" | "4K"). */
  image_size?: string;
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
    image_size: "2K",
  },
  // Desdobramento and Redimensionar: adapt an existing piece to another format.
  // Nano Banana 2 keeps texts, logo and people faithful and is fast/cheap for batches.
  image_unfold: {
    primary_model: "google/gemini-3.1-flash-image-preview",
    fallback_model: "openai/gpt-5.4-image-2",
    tertiary_model: "google/gemini-3.1-flash-image-preview",
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 0,
    image_size: "2K",
  },
  text_reasoning: {
    primary_model: "google/gemini-3-flash-preview",
    fallback_model: "openai/gpt-5.4-mini",
    tertiary_model: "anthropic/claude-3.5-haiku",
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  // Criação de KVs: strategy and writing of the brand manual (briefing → structure)
  brand_manual: {
    primary_model: "anthropic/claude-sonnet-4.5",
    fallback_model: "google/gemini-3-flash-preview",
    tertiary_model: "openai/gpt-5.4-mini",
    primary_attempts: 1,
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

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function loadModelSettings(key: ModelSettingsKey): Promise<ModelSettings> {
  const fallback = DEFAULTS[key];
  try {
    const { data } = await serviceClient()
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

/** Who/what to attribute an OpenRouter call to in the `ai_usage` table (Painel de Custos). */
export interface UsageTrack {
  functionName: string;
  projectId?: string | null;
  userId?: string | null;
  settingsKey?: ModelSettingsKey;
}

export interface CallOptions {
  /** Per-request timeout in ms. Defaults to 110000 (110s). */
  timeoutMs?: number;
  model: string;
  messages: ChatMessage[];
  modalities?: string[];
  responseFormat?: unknown;
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
  /** Output aspect ratio for image models that support `image_config` (e.g. "9:16"). */
  aspectRatio?: string | null;
  /** Output resolution for image models that support it (Gemini: "1K" | "2K" | "4K"). */
  imageSize?: string | null;
  track?: UsageTrack;
}

export interface CallResult {
  ok: boolean;
  status: number;
  data?: any;
  errorBody?: string;
  requestId?: string | null;
  retryAfter?: string | null;
  /** Cost in USD reported by OpenRouter for this call (0 when unknown). */
  costUsd?: number;
}

const ASPECT_RATIO_RE = /^\d{1,2}:\d{1,2}$/;

async function logUsage(track: UsageTrack, model: string, r: CallResult, durationMs: number) {
  try {
    const usage = r.data?.usage;
    await serviceClient().from("ai_usage").insert({
      function_name: track.functionName,
      settings_key: track.settingsKey ?? null,
      model,
      project_id: track.projectId ?? null,
      user_id: track.userId ?? null,
      success: r.ok,
      status_code: r.status || null,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      cost_usd: typeof usage?.cost === "number" ? usage.cost : null,
      duration_ms: durationMs,
    });
  } catch (e) {
    // Cost tracking must never break a generation.
    console.warn("ai_usage insert failed:", e);
  }
}

export async function callOpenRouter(opts: CallOptions): Promise<CallResult> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) {
    return { ok: false, status: 0, errorBody: "OPENROUTER_API_KEY not configured" };
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    // Ask OpenRouter to return token counts and cost in `usage`.
    usage: { include: true },
  };
  if (opts.modalities) body.modalities = opts.modalities;
  if (opts.responseFormat) body.response_format = opts.responseFormat;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.aspectRatio && ASPECT_RATIO_RE.test(opts.aspectRatio)) {
    body.image_config = { aspect_ratio: opts.aspectRatio };
  }
  // Resolution: Gemini image models (Nano Banana) take image_size; others ignore the option, so it isn't sent
  if (opts.imageSize && /^[124]K$/.test(opts.imageSize) && opts.model.startsWith("google/")) {
    body.image_config = { ...((body.image_config as Record<string, unknown>) ?? {}), image_size: opts.imageSize };
  }

  let res: Response;
  const timeoutMs = opts.timeoutMs ?? 110000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  let result: CallResult;
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
      signal: ac.signal,
    });
  } catch (e) {
    const aborted = (e as any)?.name === "AbortError";
    result = { ok: false, status: aborted ? 408 : 0, errorBody: aborted ? `Request timed out after ${timeoutMs}ms` : String(e), costUsd: 0 };
    if (opts.track) await logUsage(opts.track, opts.model, result, Date.now() - started);
    return result;
  } finally {
    clearTimeout(timer);
  }

  const requestId = res.headers.get("x-request-id") || res.headers.get("x-correlation-id");
  const retryAfter = res.headers.get("retry-after");

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    result = { ok: false, status: res.status, errorBody: text.slice(0, 2000), requestId, retryAfter, costUsd: 0 };
  } else {
    const data = await res.json();
    const cost = data?.usage?.cost;
    result = { ok: true, status: res.status, data, requestId, retryAfter, costUsd: typeof cost === "number" ? cost : 0 };
  }
  if (opts.track) await logUsage(opts.track, opts.model, result, Date.now() - started);
  return result;
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
  track?: Omit<UsageTrack, "settingsKey">;
  /** Per-attempt timeout (default 110 s). */
  timeoutMs?: number;
  /** Total time for the whole cascade: later attempts get what is left (the Edge Function has a wall-clock limit). */
  budgetMs?: number;
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
  let totalCost = 0;
  const deadline = opts.budgetMs ? Date.now() + opts.budgetMs : null;

  for (const { model, level } of cascade) {
    let timeoutMs = opts.timeoutMs;
    if (deadline) {
      const left = deadline - Date.now() - 3000;
      if (left < 15000) break; // not enough time for a meaningful attempt
      timeoutMs = Math.min(timeoutMs ?? 110000, left);
    }
    attempts++;
    const r = await callOpenRouter({
      timeoutMs,
      model,
      messages: opts.messages,
      modalities: opts.modalities,
      responseFormat: opts.responseFormat,
      temperature: opts.temperature,
      tools: opts.tools,
      toolChoice: opts.toolChoice,
      track: opts.track ? { ...opts.track, settingsKey: opts.settingsKey } : undefined,
    });
    totalCost += r.costUsd ?? 0;
    if (r.ok) {
      return { ...r, costUsd: totalCost, modelUsed: model, levelUsed: level, attempts };
    }
    last = r;
    console.warn(`[${opts.settingsKey}] ${level} ${model} failed (${r.status}): ${r.errorBody?.slice(0, 200)}`);
    if (r.status === 402) break; // credits exhausted — stop trying
    if (r.status === 429) {
      const ra = r.retryAfter ? parseInt(r.retryAfter, 10) : NaN;
      await new Promise((res) => setTimeout(res, !Number.isNaN(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 1500));
    }
  }
  return { ...last, costUsd: totalCost, attempts };
}

/* ------------------------------------------------------------------ */
/*  Image generation cascade (shared by every image-producing function) */
/* ------------------------------------------------------------------ */

export interface GenerateImageOptions {
  messages: ChatMessage[];
  /** Target aspect ratio such as "9:16". Sent as `image_config` and should also be stated in the prompt. */
  aspectRatio?: string | null;
  track?: Omit<UsageTrack, "settingsKey">;
  /** Which model cascade to use (Admin → Modelos de IA). Default: image_generation. */
  settingsKey?: "image_generation" | "image_unfold";
  /**
   * Total wall-clock budget for all attempts. Edge Functions are killed at ~150s,
   * so the default (125s) leaves room for upload + DB insert.
   */
  budgetMs?: number;
  /** Timestamp the budget is measured from (defaults to now). */
  startedAt?: number;
}

export type ImageStopReason = "credits" | "rate_limit" | "budget" | "exhausted";

export interface GenerateImageResult {
  ok: boolean;
  /** data URL (or remote URL) of the generated image */
  image?: string;
  model: string;
  level: "primary" | "fallback" | "tertiary";
  attempts: number;
  costUsd: number;
  status: number | null;
  errorBody: string | null;
  requestId: string | null;
  retryAfter: string | null;
  stopReason?: ImageStopReason;
}

export async function generateImageWithCascade(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  const settingsKey = opts.settingsKey ?? "image_generation";
  const settings = await loadModelSettings(settingsKey);
  const cascade = buildModelCascade(settings);
  const startedAt = opts.startedAt ?? Date.now();
  const budgetMs = opts.budgetMs ?? 125000;
  const track = opts.track ? { ...opts.track, settingsKey } : undefined;

  const out: GenerateImageResult = {
    ok: false, model: "", level: "primary", attempts: 0, costUsd: 0,
    status: null, errorBody: null, requestId: null, retryAfter: null,
  };

  for (let i = 0; i < cascade.length; i++) {
    const remaining = budgetMs - (Date.now() - startedAt);
    if (remaining < 20000) {
      console.warn(`Stopping image cascade: only ${remaining}ms of budget left.`);
      out.stopReason = "budget";
      return out;
    }
    const { model, level } = cascade[i];
    out.model = model;
    out.level = level;
    out.attempts = i + 1;
    const isLast = i === cascade.length - 1;

    console.log(`Image attempt ${i + 1}/${cascade.length} with ${model} (${level}), budget ${remaining}ms`);
    const r = await callOpenRouter({
      model,
      messages: opts.messages,
      modalities: ["image", "text"],
      aspectRatio: opts.aspectRatio,
      imageSize: settings.image_size ?? "2K",
      timeoutMs: Math.max(20000, Math.min(remaining - 5000, 90000)),
      track,
    });
    out.costUsd += r.costUsd ?? 0;
    out.status = r.status;
    out.requestId = r.requestId ?? null;
    out.retryAfter = r.retryAfter ?? null;

    if (!r.ok) {
      out.errorBody = r.errorBody ?? null;
      console.error(`OpenRouter image error (${model}, status ${r.status}):`, out.errorBody?.slice(0, 500));
      if (r.status === 402) {
        out.stopReason = "credits";
        return out;
      }
      if (r.status === 429) {
        if (isLast) {
          out.stopReason = "rate_limit";
          return out;
        }
        const ra = r.retryAfter ? parseInt(r.retryAfter, 10) : NaN;
        const waitMs = !Number.isNaN(ra) && ra > 0 ? Math.min(ra * 1000, 10000) : Math.min(2000 * (i + 1), 8000);
        await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      if (!isLast) await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
      continue;
    }

    const image = extractImageUrl(r.data);
    if (image) {
      out.ok = true;
      out.image = image;
      return out;
    }
    console.warn(`Attempt ${i + 1} returned no image. finish_reason: ${r.data?.choices?.[0]?.finish_reason}`);
    if (!isLast) await new Promise((res) => setTimeout(res, 800));
  }

  out.stopReason = "exhausted";
  return out;
}

/** Map a failed image generation to the HTTP error payload the frontend understands. */
export function imageFailurePayload(r: GenerateImageResult): { status: number; body: Record<string, unknown>; headers?: Record<string, string> } {
  const base = {
    source: "openrouter", provider: "openrouter", stage: "image-generation",
    model: r.model, level: r.level, attempt: r.attempts,
    request_id: r.requestId, provider_body: r.errorBody,
  };
  if (r.stopReason === "credits") {
    return { status: 402, body: { ...base, status: 402, error: "Créditos insuficientes na OpenRouter. Adicione saldo à conta." } };
  }
  if (r.stopReason === "rate_limit") {
    return {
      status: 429,
      body: { ...base, status: 429, retry_after: r.retryAfter, error: "OpenRouter está limitando novas gerações. Tente novamente em instantes." },
      headers: r.retryAfter ? { "Retry-After": r.retryAfter } : undefined,
    };
  }
  return {
    status: 502,
    body: {
      ...base,
      status: r.status,
      error: r.errorBody
        ? "Erro no provedor de IA ao gerar a imagem."
        : "A IA não conseguiu gerar a imagem após múltiplas tentativas. Tente novamente ou simplifique o prompt.",
    },
  };
}

/** Read the first tool-call arguments as JSON (structured output). */
export function parseToolCall<T = any>(data: any): T | null {
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try { return JSON.parse(toolCall.function.arguments) as T; } catch { /* fall through */ }
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { /* ignore */ } }
  }
  return null;
}
