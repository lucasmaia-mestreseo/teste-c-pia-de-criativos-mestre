import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface InvokeWithRetryOptions {
  maxRetries?: number;
  friendlyName?: string;
  projectId?: string;
  /** Don't show "tentativa X de Y" toasts (for background calls like the automatic review). */
  silent?: boolean;
}

const ERROR_MESSAGES: Record<number, string> = {
  429: 'O serviço de IA está temporariamente limitando novas gerações. Tente novamente em alguns minutos.',
  402: 'Créditos insuficientes para esta operação.',
  408: 'A requisição demorou demais. Tente novamente.',
  413: 'A imagem enviada é grande demais. Reduza o tamanho e tente novamente.',
  500: 'Erro interno do servidor. Nossa equipe foi notificada.',
  502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  503: 'Serviço em manutenção. Tente novamente em alguns minutos.',
};

interface ParsedError {
  status: number | null;
  body: any;
  message: string;
  source: string | null;
  stage: string | null;
  model: string | null;
  requestId: string | null;
  retryAfter: number | null;
}

async function parseInvokeError(error: any): Promise<ParsedError> {
  let status: number | null = error?.status || error?.context?.status || null;
  let body: any = null;
  let message = error?.message || 'Erro desconhecido';
  let source: string | null = null;
  let stage: string | null = null;
  let model: string | null = null;
  let requestId: string | null = null;
  let retryAfter: number | null = null;

  // FunctionsHttpError has a Response in context — read its body for the real error
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const res = error.context;
    status = res.status;
    requestId = res.headers.get('x-request-id') || res.headers.get('sb-request-id');
    const ra = res.headers.get('retry-after');
    if (ra) {
      const n = parseInt(ra, 10);
      if (!Number.isNaN(n)) retryAfter = n;
    }
    try {
      const text = await res.clone().text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      if (body && typeof body === 'object') {
        message = body.error || body.message || message;
        source = body.source || null;
        stage = body.stage || null;
        model = body.model || null;
        if (body.retry_after && !retryAfter) {
          const n = parseInt(String(body.retry_after), 10);
          if (!Number.isNaN(n)) retryAfter = n;
        }
      } else if (typeof body === 'string' && body.trim()) {
        message = body;
      }
    } catch {
      // ignore
    }
  }

  return { status, body, message, source, stage, model, requestId, retryAfter };
}

function getFriendlyMessage(parsed: ParsedError): string {
  if (parsed.status && ERROR_MESSAGES[parsed.status]) return ERROR_MESSAGES[parsed.status];
  const msg = parsed.message || '';
  if (msg.includes('non-2xx')) return 'O serviço retornou um erro. Estamos tentando novamente automaticamente.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (msg.includes('timeout') || msg.includes('Timeout')) return ERROR_MESSAGES[408];
  return msg || 'Erro desconhecido ao processar a requisição.';
}

async function logError(
  functionName: string,
  parsed: ParsedError,
  attempts: number,
  options: InvokeWithRetryOptions,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('error_logs' as any).insert({
      user_id: user.id,
      project_id: options.projectId || null,
      function_name: functionName,
      error_message: getFriendlyMessage(parsed),
      status_code: parsed.status,
      source: parsed.source || (parsed.status ? 'edge_function' : 'client'),
      stage: parsed.stage,
      model: parsed.model,
      request_id: parsed.requestId,
      error_details: {
        original_message: parsed.message,
        status: parsed.status,
        source: parsed.source,
        stage: parsed.stage,
        model: parsed.model,
        request_id: parsed.requestId,
        retry_after: parsed.retryAfter,
        attempts,
        provider_body: parsed.body,
        timestamp: new Date().toISOString(),
      },
    } as any);
  } catch {
    // Silently fail — don't block user flow for logging
  }
}

export async function invokeWithRetry<T = any>(
  functionName: string,
  body: Record<string, any>,
  options: InvokeWithRetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, friendlyName = functionName } = options;

  let lastParsed: ParsedError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      if (data?.error) {
        // Function returned 200 but with an error payload
        throw Object.assign(new Error(data.error), { _payload: data });
      }
      return data as T;
    } catch (e: any) {
      const parsed = await parseInvokeError(e);
      lastParsed = parsed;

      // Don't retry on credits / payload-too-large
      if (parsed.status === 402 || parsed.status === 413) break;

      // The server already ran the whole model cascade (up to 4 paid image
      // attempts) — retrying from here would multiply the cost of one click.
      if (parsed.source === 'openrouter' && parsed.stage === 'image-generation' && parsed.status !== 429) break;

      if (attempt < maxRetries) {
        // Respect retry_after if provided, else exponential backoff
        const delay = parsed.retryAfter
          ? Math.min(parsed.retryAfter * 1000, 15000)
          : Math.pow(2, attempt - 1) * 1000;

        const isRateLimit = parsed.status === 429;
        if (!options.silent) {
          toast.info(`Tentativa ${attempt + 1} de ${maxRetries}...`, {
            description: isRateLimit
              ? `Serviço de IA limitando. Aguardando ${Math.round(delay / 1000)}s antes de tentar novamente.`
              : `Reconectando com ${friendlyName}`,
            duration: delay,
          });
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  if (lastParsed) {
    await logError(functionName, lastParsed, maxRetries, options);
    throw new Error(getFriendlyMessage(lastParsed));
  }

  throw new Error('Erro desconhecido');
}
