import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBrandKit(projectId: string | null) {
  return useQuery({
    queryKey: ['brand_kit', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('project_id', projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertBrandKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      colors?: string[];
      typography?: string;
      logo_url?: string;
      photos?: string[];
      primary_color?: string;
      secondary_color?: string;
      background_color?: string;
      aux_colors?: string[];
      people_photos?: string[];
    }) => {
      const { data, error } = await supabase
        .from('brand_kits')
        .upsert(input, { onConflict: 'project_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['brand_kit', vars.project_id] }),
  });
}
