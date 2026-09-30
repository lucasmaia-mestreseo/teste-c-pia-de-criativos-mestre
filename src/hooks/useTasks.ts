import { useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tarefas: a project (client) has tasks — "Solicitação de Banners - Atualização
 * de Campanhas" — and every piece generated while a task is selected belongs to
 * it, numbered B01, B02… The selected task is remembered per project.
 */

export interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  archived: boolean;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tasksTable = () => (supabase as any).from('project_tasks');

export function useProjectTasks(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectTask[]> => {
      const { data, error } = await tasksTable().select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (error) return []; // migration not applied yet: the app works without tasks
      return data ?? [];
    },
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<ProjectTask> => {
      const { data, error } = await tasksTable().insert({ project_id: projectId, name: name.trim() }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setCurrentTaskId(projectId, task.id);
    },
  });
}

export function useRenameTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await tasksTable().update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
  });
}

/* ─── the task being worked on (per project, shared by every tool) ─── */

const key = (projectId: string) => `cm-current-task:${projectId}`;
const listeners = new Set<() => void>();

export function getCurrentTaskId(projectId: string | null | undefined): string | null {
  if (!projectId) return null;
  try { return localStorage.getItem(key(projectId)) || null; } catch { return null; }
}

export function setCurrentTaskId(projectId: string, taskId: string | null) {
  try {
    if (taskId) localStorage.setItem(key(projectId), taskId);
    else localStorage.removeItem(key(projectId));
  } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function useCurrentTaskId(projectId: string | null | undefined): string | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => getCurrentTaskId(projectId),
    () => null,
  );
}

/** The selected task, if it still exists in this project. */
export function useCurrentTask(projectId: string | null | undefined): ProjectTask | null {
  const id = useCurrentTaskId(projectId);
  const { data } = useProjectTasks(projectId);
  return (id && data?.find((t) => t.id === id)) || null;
}

/** Next banner number of a task (B01, B02…) — used to give each Desdobramento piece its own number up front. */
export async function nextBannerNumber(taskId: string): Promise<number> {
  const { data } = await supabase
    .from('generated_creatives')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('banner_number' as any)
    .eq('task_id' as never, taskId)
    .not('banner_number' as never, 'is', null)
    .order('banner_number' as never, { ascending: false })
    .limit(1);
  const n = (data?.[0] as { banner_number?: number } | undefined)?.banner_number ?? 0;
  return n + 1;
}
