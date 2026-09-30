import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { creativeFileName, imageAtFormatSize, saveBlob } from '@/lib/creativeNames';
import { makeZip } from '@/lib/zip';

export interface DownloadableCreative {
  id: string;
  image_url: string;
  format: string;
  project_id?: string;
  task_id?: string | null;
  banner_number?: number | null;
}

const taskNames = new Map<string, string>();

async function taskName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  if (taskNames.has(id)) return taskNames.get(id)!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('project_tasks').select('name').eq('id', id).maybeSingle();
  if (data?.name) taskNames.set(id, data.name);
  return data?.name ?? null;
}

/**
 * Download pieces with the agency's naming — [Cliente] [1080x1350] [B01] Tarefa —
 * at the exact pixel size of the format. Many pieces go in one .zip.
 * Works across projects (dashboard, history): the client is each piece's project.
 */
export function useCreativeDownload(fallbackProjectId?: string | null) {
  const { data: projects } = useProjects();

  const nameOf = useCallback(async (c: DownloadableCreative) => {
    const pid = c.project_id ?? fallbackProjectId;
    const client = projects?.find((p) => p.id === pid)?.name ?? 'Cliente';
    return creativeFileName({ client, format: c.format, bannerNumber: c.banner_number, task: await taskName(c.task_id), id: c.id });
  }, [projects, fallbackProjectId]);

  const downloadOne = useCallback(async (c: DownloadableCreative) => {
    try {
      saveBlob(await imageAtFormatSize(c.image_url, c.format), await nameOf(c));
    } catch (e) {
      toast.error('Erro no download', { description: e instanceof Error ? e.message : undefined });
    }
  }, [nameOf]);

  const downloadMany = useCallback(async (items: DownloadableCreative[], zipLabel?: string) => {
    if (!items.length) return;
    if (items.length === 1) return downloadOne(items[0]);
    const id = toast.loading(`Preparando ${items.length} arquivos…`);
    try {
      const used = new Map<string, number>();
      const files: { name: string; data: Blob }[] = [];
      for (const c of items) {
        let name = await nameOf(c);
        const n = (used.get(name) ?? 0) + 1;
        used.set(name, n);
        if (n > 1) name = name.replace(/\.png$/, ` (${n}).png`);
        files.push({ name, data: await imageAtFormatSize(c.image_url, c.format) });
      }
      const label = zipLabel || projects?.find((p) => p.id === (items[0].project_id ?? fallbackProjectId))?.name || 'criativos';
      saveBlob(await makeZip(files), `${label.replace(/[\\/:*?"<>|]+/g, '-').trim()}.zip`);
      toast.success(`${files.length} arquivos baixados`, { id });
    } catch (e) {
      toast.error('Erro no download', { id, description: e instanceof Error ? e.message : undefined });
    }
  }, [downloadOne, nameOf, projects, fallbackProjectId]);

  return { downloadOne, downloadMany };
}
