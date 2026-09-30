import { useState } from 'react';
import { Check, ChevronsUpDown, ListTodo, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setCurrentTaskId, useCreateTask, useCurrentTask, useProjectTasks } from '@/hooks/useTasks';

/**
 * The task being worked on inside the project (e.g. "Solicitação de Banners -
 * Atualização de Campanhas"). New pieces go into it, numbered B01, B02…
 */
export default function TaskSelector({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const current = useCurrentTask(projectId);
  const create = useCreateTask(projectId);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    if (tasks?.some((t) => t.name.toLowerCase() === n.toLowerCase())) { toast.error('Já existe uma tarefa com esse nome neste projeto'); return; }
    try {
      await create.mutateAsync(n);
      setName('');
      setAdding(false);
      setOpen(false);
      toast.success('Tarefa criada', { description: 'As próximas peças entram nela, numeradas B01, B02…' });
    } catch (e) {
      toast.error('Não foi possível criar a tarefa', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAdding(false); }}>
      <PopoverTrigger asChild>
        <button className={cn('group flex items-center gap-1.5 h-8 max-w-[240px] rounded-lg border px-2 text-[11px] transition-colors hover:border-primary/50',
          current ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-secondary text-muted-foreground')}>
          <ListTodo className={cn('h-3.5 w-3.5 flex-none', current ? 'text-primary' : '')} />
          <span className="truncate font-medium">{current ? current.name : 'Escolha a tarefa'}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 pt-3 pb-2">
          <p className="text-xs font-semibold">Tarefa</p>
          <p className="text-[11px] text-muted-foreground">As peças novas entram nela e ganham número (B01, B02…). O download sai no padrão [Cliente] [1080x1350] [B01] Tarefa.</p>
        </div>
        <div className="max-h-64 overflow-y-auto px-1.5 pb-1.5">
          {isLoading && <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
          {(tasks ?? []).filter((t) => !t.archived).map((t) => (
            <button key={t.id} onClick={() => { setCurrentTaskId(projectId, t.id); setOpen(false); }}
              className={cn('w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors', current?.id === t.id ? 'bg-primary/10' : 'hover:bg-secondary')}>
              <Check className={cn('h-3.5 w-3.5 flex-none text-primary', current?.id === t.id ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate" title={t.name}>{t.name}</span>
            </button>
          ))}
          <button onClick={() => { setCurrentTaskId(projectId, null); setOpen(false); }}
            className={cn('w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors', !current ? 'bg-secondary' : 'hover:bg-secondary')}>
            <Check className={cn('h-3.5 w-3.5 flex-none text-primary', !current ? 'opacity-100' : 'opacity-0')} />
            Sem tarefa (peças avulsas)
          </button>
        </div>
        <div className="border-t p-2">
          {adding ? (
            <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex gap-1.5">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Solicitação de Banners - Atualização de Campanhas" className="h-8 text-xs bg-secondary" />
              <Button type="submit" size="sm" className="h-8" disabled={!name.trim() || create.isPending}>{create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar'}</Button>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Nova tarefa
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
