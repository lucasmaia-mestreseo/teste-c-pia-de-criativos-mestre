import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGeneratedCreatives(projectId: string | null) {
  return useQuery({
    queryKey: ['generated_creatives', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_creatives')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteCreative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('generated_creatives').delete().eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['generated_creatives', data.projectId] });
      qc.invalidateQueries({ queryKey: ['dashboard-recent'] });
      qc.invalidateQueries({ queryKey: ['dashboard-total'] });
      qc.invalidateQueries({ queryKey: ['dashboard-7days'] });
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] });
    },
    onError: (error: any) => {
      console.error('Delete creative error:', error);
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, favorite }: { id: string; projectId: string; favorite: boolean }) => {
      const { error } = await supabase
        .from('generated_creatives')
        .update({ favorite } as any)
        .eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['generated_creatives', data.projectId] }),
  });
}
