import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardStats() {
  const { user } = useAuth();

  const totalQuery = useQuery({
    queryKey: ['dashboard-total', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('generated_creatives')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const last7DaysQuery = useQuery({
    queryKey: ['dashboard-7days', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count, error } = await supabase
        .from('generated_creatives')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const recentCreativesQuery = useQuery({
    queryKey: ['dashboard-recent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_creatives')
        .select('id, image_url, project_id, created_at, format')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const recentProjectsQuery = useQuery({
    queryKey: ['dashboard-projects', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: creatives, error: cErr } = await supabase
        .from('generated_creatives')
        .select('project_id, created_at')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });
      if (cErr) throw cErr;

      const projectMap = new Map<string, string>();
      for (const c of creatives ?? []) {
        if (!projectMap.has(c.project_id)) {
          projectMap.set(c.project_id, c.created_at);
        }
      }

      if (projectMap.size === 0) return [];

      const { data: projects, error: pErr } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', Array.from(projectMap.keys()));
      if (pErr) throw pErr;

      return (projects ?? [])
        .map((p) => ({ ...p, lastGenerated: projectMap.get(p.id)! }))
        .sort((a, b) => new Date(b.lastGenerated).getTime() - new Date(a.lastGenerated).getTime());
    },
  });

  return {
    total: totalQuery.data ?? 0,
    last7Days: last7DaysQuery.data ?? 0,
    recentCreatives: recentCreativesQuery.data ?? [],
    recentProjects: recentProjectsQuery.data ?? [],
    isLoading: totalQuery.isLoading || last7DaysQuery.isLoading || recentCreativesQuery.isLoading || recentProjectsQuery.isLoading,
  };
}
