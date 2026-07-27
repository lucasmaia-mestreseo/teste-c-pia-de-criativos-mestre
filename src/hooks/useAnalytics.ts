import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsRange } from '@/components/admin/AnalyticsFilters';

export interface CreativeRow {
  id: string;
  project_id: string;
  created_by: string | null;
  created_at: string;
}

export function useProfilesLite() {
  return useQuery({
    queryKey: ['analytics-profiles-lite'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name').order('name');
      if (error) throw error;
      return (data ?? []).map((p) => ({ id: p.user_id, name: p.name }));
    },
  });
}

export function useProjectsLite() {
  return useQuery({
    queryKey: ['analytics-projects-lite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, active')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface AnalyticsQueryParams {
  range: AnalyticsRange;
  projectId: string | null;
  userId: string | null;
}

export function useCreativesInRange({ range, projectId, userId }: AnalyticsQueryParams) {
  return useQuery({
    queryKey: ['analytics-creatives', range.from.toISOString(), range.to.toISOString(), projectId, userId],
    queryFn: async () => {
      let q = supabase
        .from('generated_creatives')
        .select('id, project_id, created_by, created_at')
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString());
      if (projectId) q = q.eq('project_id', projectId);
      if (userId) q = q.eq('created_by', userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CreativeRow[];
    },
  });
}

// Last creative date per project across all history (for client-health view)
export function useProjectLastCreative() {
  return useQuery({
    queryKey: ['analytics-project-last-creative'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_creatives')
        .select('project_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of data ?? []) {
        if (!map.has(r.project_id)) map.set(r.project_id, r.created_at);
      }
      return map;
    },
  });
}
