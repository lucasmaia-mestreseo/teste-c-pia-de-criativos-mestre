import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSwipeFiles(projectId: string | null) {
  return useQuery({
    queryKey: ['swipe_files', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swipe_files')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadSwipeFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('swipe-files')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('swipe-files')
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from('swipe_files')
        .insert({
          project_id: projectId,
          image_url: publicUrl,
          name: file.name,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['swipe_files', data.project_id] }),
  });
}

export function useDeleteSwipeFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('swipe_files').delete().eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['swipe_files', data.projectId] }),
  });
}
