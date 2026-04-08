import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvokeWithRetryOptions {
  maxRetries?: number;
  friendlyName?: string;
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
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        toast.info(`Tentativa ${attempt + 1} de ${maxRetries}...`, {
          description: `Reconectando com ${friendlyName}`,
          duration: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const message = lastError?.message || `Erro ao executar ${friendlyName}`;
  throw new Error(message);
}
