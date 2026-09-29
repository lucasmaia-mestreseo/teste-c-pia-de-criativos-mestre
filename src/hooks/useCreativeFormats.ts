import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCreativeFormats() {
  return useQuery({
    queryKey: ['creative_formats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creative_formats')
        .select('*')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

const FALLBACK_FORMATS = ['9:16', '4:5', '1:1', '16:9'];

/** Active format labels (e.g. "9:16"), with a sensible fallback while loading. */
export function useFormatOptions(): string[] {
  const { data: formats } = useCreativeFormats();
  const labels = (formats || []).map((f) => f.label);
  return labels.length ? labels : FALLBACK_FORMATS;
}
