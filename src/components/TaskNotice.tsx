import { useState } from 'react';
import { FolderPlus, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bannerLabel } from '@/lib/creativeNames';
import { useCurrentTask, useProjectTasks, setCurrentTaskId } from '@/hooks/useTasks';
import { NewTaskDialog } from '@/components/TasksPanel';

/**
 * Shown at the top of Gerar and Desdobramento: which task the new pieces go
 * into — or, without one, a nudge to create it (pieces would be "avulsas").
 */
export default function TaskNotice({ projectId, className }: { projectId: string; className?: string }) {
  const current = useCurrentTask(projectId);
  const { data: tasks } = useProjectTasks(projectId);
  const [open, setOpen] = useState(false);
  const others = (tasks ?? []).filter((t) => !t.archived);

  if (current) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-[11px] text-muted-foreground', className)}>
        <ListTodo className="h-3.5 w-3.5 text-primary flex-none" />
        <span className="truncate">Tarefa: <b className="text-foreground" title={current.name}>{current.name}</b></span>
        <span className="ml-auto flex-none opacity-70">{bannerLabel(1)}, {bannerLabel(2)}…</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in duration-300', className)}>
      <p className="text-xs"><b>Sem tarefa escolhida.</b> <span className="text-muted-foreground">As peças ficam avulsas, sem número e sem o nome da tarefa no arquivo.</span></p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-semibold hover:opacity-90 transition-opacity">
          <FolderPlus className="h-3.5 w-3.5" /> Criar tarefa
        </button>
        {others.slice(0, 3).map((t) => (
          <button key={t.id} onClick={() => setCurrentTaskId(projectId, t.id)} title={t.name}
            className="max-w-[180px] truncate rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
            {t.name}
          </button>
        ))}
      </div>
      <NewTaskDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
