import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvokeWithRetryOptions {
  maxRetries?: number;
  friendlyName?: string;
  projectId?: string;
}

const ERROR_MESSAGES: Record<number, string> = {
  429: 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.',
  402: 'Créditos insuficientes para esta operação.',
  408: 'A requisição demorou demais. Tente novamente.',
  413: 'A imagem enviada é grande demais. Reduza o tamanho e tente novamente.',
  500: 'Erro interno do servidor. Nossa equipe foi notificada.',
  502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  503: 'Serviço em manutenção. Tente novamente em alguns minutos.',
};

function getFriendlyMessage(error: any): string {
  const msg = error?.message || '';
  const status = error?.status || error?.context?.status;

  if (status && ERROR_MESSAGES[status]) return ERROR_MESSAGES[status];

  if (msg.includes('non-2xx')) return 'O serviço retornou um erro. Estamos tentando novamente automaticamente.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (msg.includes('timeout') || msg.includes('Timeout')) return ERROR_MESSAGES[408];

  return msg || 'Erro desconhecido ao processar a requisição.';
}

async function logError(functionName: string, error: any, options: InvokeWithRetryOptions) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('error_logs' as any).insert({
      user_id: user.id,
      project_id: options.projectId || null,
      function_name: functionName,
      error_message: getFriendlyMessage(error),
      error_details: {
        original_message: error?.message,
        status: error?.status || error?.context?.status,
        attempts: options.maxRetries || 3,
        timestamp: new Date().toISOString(),
      },
    } as any);
  } catch {
    // Silently fail — don't block the user flow for logging
  }
}

export async function invokeWithRetry<T = any>(
  functionName: string,
  body: Record<string, any>,
  options: InvokeWithRetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, friendlyName = functionName } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as T;
    } catch (e: any) {
      lastError = e;

      // Don't retry on 402 (credits) or 413 (payload too large)
      const status = e?.status || e?.context?.status;
      if (status === 402 || status === 413) break;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        toast.info(`Tentativa ${attempt + 1} de ${maxRetries}...`, {
          description: `Reconectando com ${friendlyName}`,
          duration: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Log the error after all retries exhausted
  await logError(functionName, lastError, options);

  const message = getFriendlyMessage(lastError);
  throw new Error(message);
}
