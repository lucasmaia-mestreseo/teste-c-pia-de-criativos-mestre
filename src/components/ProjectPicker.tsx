import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock3, FolderOpen, Loader2, Plus, Search, Star, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateProject, useProjects } from '@/hooks/useProjects';
import { isMine, projectColor, projectInitials, recentProjects, rememberCreatedProject, type ProjectLike } from '@/lib/projectLists';

export type ProjectTab = 'recentes' | 'meus' | 'todos';

/** Brand color of each project (from its Brand Kit), for the avatars. */
export function useBrandColors() {
  return useQuery({
    queryKey: ['brand-colors'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_kits').select('project_id, primary_color');
      return Object.fromEntries((data ?? []).filter((k) => k.primary_color).map((k) => [k.project_id, k.primary_color as string]));
    },
    staleTime: 60_000,
  });
}

/** The projects this person can see, split in the three lists. */
export function useProjectLists() {
  const { user } = useAuth();
  const { data: all, isLoading } = useProjects();
  const { canAccessProject } = usePermissions();
  return useMemo(() => {
    const visible = ((all ?? []) as ProjectLike[]).filter((p) => p.active !== false && canAccessProject(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return {
      isLoading,
      todos: visible,
      meus: visible.filter((p) => isMine(p, user?.id)),
      recentes: recentProjects(visible, user?.id, 8),
    };
  }, [all, canAccessProject, user?.id, isLoading]);
}

/** Name → new project (checks duplicates). Returns the new id. */
export function useCreateProjectByName() {
  const { user } = useAuth();
  const { data: all } = useProjects();
  const create = useCreateProject();
  const run = async (raw: string): Promise<string | null> => {
    const name = raw.trim();
    if (!name) return null;
    if ((all ?? []).some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error('Já existe um projeto com esse nome', { description: 'Procure por ele em "Todos os projetos".' });
      return null;
    }
    try {
      const p = await create.mutateAsync({ name });
      rememberCreatedProject(user?.id, p.id);
      toast.success(`Projeto "${name}" criado`);
      return p.id;
    } catch (e) {
      toast.error((e as { code?: string })?.code === '23505' ? 'Já existe um projeto com esse nome' : 'Não foi possível criar o projeto');
      return null;
    }
  };
  return { create: run, creating: create.isPending };
}

const TABS: { id: ProjectTab; label: string; icon: typeof Clock3 }[] = [
  { id: 'recentes', label: 'Recentes', icon: Clock3 },
  { id: 'meus', label: 'Meus projetos', icon: UserRound },
  { id: 'todos', label: 'Todos', icon: FolderOpen },
];

interface PickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** e.g. "Desdobramento" — shown in the title. */
  toolName?: string;
  currentProjectId?: string | null;
  onPick: (projectId: string) => void;
}

/** One project picker for every tool: create a new one right here, or pick from Recentes / Meus / Todos. */
export default function ProjectPicker({ open, onOpenChange, toolName, currentProjectId, onPick }: PickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 grid-cols-1">
        <DialogHeader className="px-5 pt-5 pb-3 pr-12 text-left min-w-0">
          <DialogTitle>{toolName ? `${toolName}: em qual projeto?` : 'Trocar de projeto'}</DialogTitle>
          <DialogDescription>Cada projeto é um cliente ou marca, com o seu Brand Kit, contexto e guias.</DialogDescription>
        </DialogHeader>
        {open && <ProjectBrowser currentProjectId={currentProjectId} onPick={(id) => { onOpenChange(false); onPick(id); }} />}
      </DialogContent>
    </Dialog>
  );
}

function ProjectBrowser({ currentProjectId, onPick }: { currentProjectId?: string | null; onPick: (id: string) => void }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const lists = useProjectLists();
  const { data: colors } = useBrandColors();
  const { create, creating } = useCreateProjectByName();
  const [tab, setTab] = useState<ProjectTab>(() => (lists.recentes.length ? 'recentes' : 'todos'));
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [creatingOpen, setCreatingOpen] = useState(false);

  const source = q.trim() ? lists.todos : lists[tab];
  const items = source.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const submit = async () => {
    const id = await create(newName);
    if (id) onPick(id);
  };

  return (
    <div className="flex flex-col max-h-[70vh] min-w-0 w-full">
      {/* create */}
      {can('create_project') && (
        <div className="px-5 pb-3">
          {creatingOpen ? (
            <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do cliente ou marca" className="h-10 bg-secondary" />
              <Button type="submit" disabled={!newName.trim() || creating} className="h-10 gap-1.5">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Criar
              </Button>
            </form>
          ) : (
            <button onClick={() => setCreatingOpen(true)}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left transition-all duration-200 hover:border-primary hover:bg-primary/10 group">
              <span className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center transition-transform group-hover:scale-105"><Plus className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold">Criar novo projeto</span>
                <span className="block text-[11px] text-muted-foreground">Só o nome — o resto você completa depois</span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* search + tabs */}
      <div className="px-5 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar em todos os projetos" className="h-9 pl-8 text-xs bg-secondary" />
        </div>
        {!q.trim() && (
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('relative flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-colors', tab === t.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {tab === t.id && <motion.span layoutId="picker-tab" className="absolute inset-0 rounded-md bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <Icon className="h-3.5 w-3.5 relative" />
                  <span className="relative">{t.label}</span>
                  <span className="relative opacity-60 tabular-nums">{lists[t.id].length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* list */}
      <div key={q.trim() ? 'q' : tab} className="flex-1 overflow-y-auto px-3 py-3 animate-in fade-in duration-200">
        {lists.isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10 px-6">
            {q.trim() ? 'Nenhum projeto com esse nome.' : tab === 'meus' ? 'Você ainda não criou projetos. Os que você criar aparecem aqui.' : 'Nenhum projeto ainda.'}
          </p>
        ) : (
          <div className="space-y-0.5 stagger">
            {items.map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)}
                className={cn('group w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', p.id === currentProjectId ? 'bg-primary/10' : 'hover:bg-secondary')}>
                <ProjectAvatar id={p.id} name={p.name} color={colors?.[p.id]} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium min-w-0">
                    <span className="truncate" title={p.name}>{p.name}</span>
                    {isMine(p, user?.id) && <Star className="h-3 w-3 text-primary fill-primary flex-none" aria-label="Criado por você" />}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {p.updated_at ? `atualizado ${formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: ptBR })}` : 'projeto'}
                  </span>
                </span>
                {p.id === currentProjectId
                  ? <Check className="h-4 w-4 text-primary" />
                  : <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectAvatar({ id, name, color, size = 'md' }: { id: string; name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const bg = color || projectColor(id);
  return (
    <span className={cn('rounded-lg flex items-center justify-center font-bold flex-none shadow-sm', size === 'lg' ? 'h-11 w-11 text-sm' : size === 'sm' ? 'h-6 w-6 rounded-md text-[9px]' : 'h-9 w-9 text-xs')}
      style={{ background: bg, color: readable(bg) }}>
      {projectInitials(name)}
    </span>
  );
}

/** Black or white initials, whichever reads better on the brand color. */
function readable(color: string): string {
  const m = color.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}
