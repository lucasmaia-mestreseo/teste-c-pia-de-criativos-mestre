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
