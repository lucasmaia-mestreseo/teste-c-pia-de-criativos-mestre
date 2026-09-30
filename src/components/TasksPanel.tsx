import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, Folder, FolderOpen, Layers, Loader2, Palette, Plus, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/useProject';
import { useGeneratedCreatives } from '@/hooks/useGeneratedCreatives';
import { setCurrentTaskId, useCreateTask, useCurrentTaskId, useProjectTasks, type ProjectTask } from '@/hooks/useTasks';
import { useCreativeDownload, type DownloadableCreative } from '@/hooks/useCreativeDownload';
import { bannerLabel, pixelsLabel } from '@/lib/creativeNames';
import { formatName } from '@/lib/formatNames';
import ActiveGuideBadge from '@/components/kv/ActiveGuideBadge';
import { collapseOptions } from '@/lib/creativeOptions';
import { OptionsBadge, OptionsStrip } from '@/components/CreativeOptions';

type Creative = DownloadableCreative & { created_at: string; prompt?: string | null; generation_meta?: unknown };

const LOOSE = '__avulsas__';

/**
 * The project as a folder: the client's identity (Brand Kit, contexto, guia) is
 * shared by the whole project; tasks only organize the pieces. Opening a task
 * shows its banners (B01, B02…) with every format side by side.
 */
export default function TasksPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const currentTaskId = useCurrentTaskId(projectId);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  // coming from a new project: open "Nova tarefa" right away
  const location = useLocation();
  const [newOpen, setNewOpen] = useState<boolean>(() => !!(location.state as { newTask?: boolean } | null)?.newTask);

  // Opções (2x/4x): only the chosen option of each piece counts (folder, counts and .zip)
  const { primaries: all, optionsOf } = useMemo(() => collapseOptions((creatives ?? []) as unknown as Creative[]), [creatives]);
  const byTask = useMemo(() => {
    const m = new Map<string, Creative[]>();
    for (const c of all) {
      const k = c.task_id ?? LOOSE;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [all]);

  const visibleTasks = (tasks ?? []).filter((t) => !t.archived);
  const loose = byTask.get(LOOSE) ?? [];

  const openTool = (taskId: string | null, panel: 'unfold' | 'generate') => {
    setCurrentTaskId(projectId, taskId);
    navigate(`/project/${projectId}/${panel}`);
  };

  if (openFolder) {
    const task = openFolder === LOOSE ? null : visibleTasks.find((t) => t.id === openFolder) ?? null;
    return (
      <FolderView projectId={projectId} task={task} items={byTask.get(openFolder) ?? []} optionsOf={optionsOf}
        onBack={() => setOpenFolder(null)} onTool={(panel) => openTool(task?.id ?? null, panel)} />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* the brand: shared by every task */}
        <div className="rounded-2xl border bg-gradient-to-br from-card to-secondary/40 p-5 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Cliente</p>
            <h1 className="text-2xl font-bold truncate" title={project?.name}>{project?.name ?? '…'}</h1>
            <div className="mt-2"><ActiveGuideBadge projectId={projectId} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/project/${projectId}/brandkit`)}><Palette className="h-3.5 w-3.5" /> Brand Kit</Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/project/${projectId}/context`)}>Contexto</Button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Tarefas</h2>
            <p className="text-xs text-muted-foreground">Cada tarefa guarda as peças de uma solicitação — numeradas B01, B02… em todos os formatos.</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova tarefa</Button>
        </div>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {visibleTasks.length === 0 && (
              <button onClick={() => setNewOpen(true)}
                className="sm:col-span-2 lg:col-span-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 flex flex-col items-center gap-2 text-center transition-colors hover:border-primary hover:bg-primary/10">
                <FolderOpen className="h-8 w-8 text-primary" />
                <span className="text-base font-bold">Crie a primeira tarefa</span>
                <span className="text-sm text-muted-foreground max-w-md">Ex.: “Solicitação de Banners - Atualização de Campanhas”. As peças que você gerar ou desdobrar entram nela, já com o nome no padrão da agência.</span>
              </button>
            )}
            {visibleTasks.map((t) => (
              <FolderCard key={t.id} name={t.name} items={byTask.get(t.id) ?? []} active={t.id === currentTaskId}
                subtitle={`criada ${formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}`}
                onOpen={() => { setCurrentTaskId(projectId, t.id); setOpenFolder(t.id); }} />
            ))}
            {loose.length > 0 && (
              <FolderCard name="Peças avulsas" items={loose} muted subtitle="sem tarefa" onOpen={() => setOpenFolder(LOOSE)} />
            )}
          </div>
        )}
      </div>

      <NewTaskDialog projectId={projectId} open={newOpen} onOpenChange={setNewOpen}
        onCreated={(t) => { setOpenFolder(t.id); }} />
    </div>
  );
}

function FolderCard({ name, items, subtitle, active, muted, onOpen }: { name: string; items: Creative[]; subtitle: string; active?: boolean; muted?: boolean; onOpen: () => void }) {
  const banners = new Set(items.map((c) => c.banner_number).filter(Boolean)).size;
  const thumbs = items.slice(0, 4);
  return (
    <button onClick={onOpen}
      className={cn('group text-left rounded-2xl border bg-card p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/50',
        active && 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]')}>
      <div className="flex items-start gap-3">
        <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-none transition-transform group-hover:scale-105', muted ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary')}>
          <Folder className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug line-clamp-2" title={name}>{name}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">{subtitle}</span>
        </span>
        {active && <span className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 flex-none">Atual</span>}
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-16">
        {thumbs.map((c) => (
          <div key={c.id} className="rounded-md bg-secondary overflow-hidden flex items-center justify-center">
            <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - thumbs.length) }, (_, i) => <div key={i} className="rounded-md border border-dashed border-border/60" />)}
      </div>
      <div className="text-[11px] text-muted-foreground">
        <b className="text-foreground">{items.length}</b> peça(s){banners ? <> · <b className="text-foreground">{banners}</b> banner(s)</> : null}
      </div>
    </button>
  );
}

function FolderView({ projectId, task, items, optionsOf, onBack, onTool }: {
  projectId: string; task: ProjectTask | null; items: Creative[]; optionsOf: (c: Creative) => Creative[]; onBack: () => void; onTool: (panel: 'unfold' | 'generate') => void;
}) {
  const { downloadOne, downloadMany } = useCreativeDownload(projectId);
  const [preview, setPreview] = useState<Creative | null>(null);

  // B01, B02… each with its formats; pieces without number at the end
  const groups = useMemo(() => {
    const m = new Map<string, Creative[]>();
    for (const c of [...items].sort((a, b) => (a.banner_number ?? 999) - (b.banner_number ?? 999) || a.created_at.localeCompare(b.created_at))) {
      const k = bannerLabel(c.banner_number) ?? 'Sem número';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [items]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Todas as tarefas</button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-xl font-bold leading-snug">{task?.name ?? 'Peças avulsas'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{items.length} peça(s){task ? ' · as novas peças desta tarefa continuam a numeração' : ' · peças geradas sem tarefa'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {task && <Button size="sm" className="gap-1.5 btn-shine" onClick={() => onTool('unfold')}><Layers className="h-3.5 w-3.5" /> Desdobrar peças</Button>}
            {task && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onTool('generate')}><Zap className="h-3.5 w-3.5" /> Gerar peça</Button>}
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!items.length} onClick={() => downloadMany(items, task?.name)}><Download className="h-3.5 w-3.5" /> Baixar tudo (.zip)</Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-2">
            <Sparkles className="h-7 w-7 text-primary mx-auto" />
            <p className="text-sm font-semibold">Tarefa vazia</p>
            <p className="text-xs text-muted-foreground">Desdobre as peças aprovadas ou gere uma peça nova — elas aparecem aqui como B01, B02…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([label, list]) => (
              <section key={label} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5">{label}</span>
                  <span className="text-[11px] text-muted-foreground">{list.length} formato(s)</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => downloadMany(list, `${task?.name ?? 'avulsas'} ${label}`)}><Download className="h-3 w-3" /> Baixar {label}</Button>
                </div>
                <div className="flex flex-wrap gap-3 items-end pb-1">
                  {list.map((c) => (
                    <div key={c.id} className="group flex flex-col items-center gap-1.5 flex-none">
                      <button onClick={() => setPreview(c)} className="relative rounded-lg overflow-hidden border bg-secondary h-40 flex items-center transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40">
                        <img src={c.image_url} alt="" className="h-full w-auto object-contain" />
                        <OptionsBadge count={optionsOf(c).length} />
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">{pixelsLabel(c.format) || formatName(c.format)}</span>
                        <button onClick={() => downloadOne(c)} className="text-muted-foreground hover:text-primary" title="Baixar"><Download className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl p-3">
          {preview && (
            <div className="space-y-3">
              <img src={preview.image_url} alt="" className="max-h-[75vh] w-full object-contain rounded-md bg-black/30" />
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-muted-foreground flex-1">{bannerLabel(preview.banner_number) ?? ''} · {pixelsLabel(preview.format)}</span>
                <Button size="sm" className="gap-1.5" onClick={() => downloadOne(preview)}><Download className="h-3.5 w-3.5" /> Baixar</Button>
              </div>
              <OptionsStrip className="max-w-sm" projectId={projectId} takes={optionsOf(preview)} viewingId={preview.id} onView={(id) => setPreview(optionsOf(preview).find((t) => t.id === id) ?? preview)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NewTaskDialog({ projectId, open, onOpenChange, onCreated }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (t: ProjectTask) => void }) {
  const { data: tasks } = useProjectTasks(projectId);
  const create = useCreateTask(projectId);
  const [name, setName] = useState('');
  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    if (tasks?.some((t) => t.name.toLowerCase() === n.toLowerCase())) { toast.error('Já existe uma tarefa com esse nome neste projeto'); return; }
    try {
      const t = await create.mutateAsync(n);
      setName('');
      onOpenChange(false);
      toast.success('Tarefa criada', { description: 'As próximas peças entram nela, numeradas B01, B02…' });
      onCreated?.(t);
    } catch (e) {
      toast.error('Não foi possível criar a tarefa', { description: e instanceof Error ? e.message : 'Confira se a atualização do banco (Tarefas) já foi aplicada.' });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>O nome da solicitação, como vai no arquivo: [Cliente] [1080x1350] [B01] <b>Nome da tarefa</b>.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Solicitação de Banners - Atualização de Campanhas" className="bg-secondary" />
          <Button type="submit" className="w-full" disabled={!name.trim() || create.isPending}>{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar tarefa'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
