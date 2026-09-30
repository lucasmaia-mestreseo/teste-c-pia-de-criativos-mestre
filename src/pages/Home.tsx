import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Clock3, FolderOpen, Loader2, Plus, Search, Star, UserRound, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserMenu from '@/components/UserMenu';
import { ReleaseNotesButton } from '@/components/ReleaseNotes';
import TestVersionBadge from '@/components/TestVersionBadge';
import ToolArt from '@/components/ToolArt';
import ProjectPicker, { ProjectAvatar, useBrandColors, useCreateProjectByName, useProjectLists, type ProjectTab } from '@/components/ProjectPicker';
import { TOOLS, type ToolDefinition } from '@/lib/tools';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { isMine } from '@/lib/projectLists';
import { cn } from '@/lib/utils';

/**
 * Tools hub — the first screen after login. One screen, no page scroll:
 * tools on the left, the agency's projects on the right (the list scrolls inside).
 */
export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [pickingFor, setPickingFor] = useState<ToolDefinition | null>(null);
  const firstName = profile?.name?.split(' ')[0];

  const openTool = (tool: ToolDefinition) => {
    if (tool.available === false) return;
    if (tool.path) navigate(tool.path);
    else if (tool.projectPanel) setPickingFor(tool);
  };

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      {/* soft brand glow behind the title */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/3 -translate-x-1/2 h-[420px] w-[820px] rounded-full bg-primary/10 blur-[120px]" />
      <header className="relative h-12 border-b bg-card/80 backdrop-blur flex items-center px-4 gap-2 flex-shrink-0">
        <Zap className="h-4 w-4 text-primary fill-primary" />
        <span className="text-sm font-bold tracking-tight">Criativos Mestre</span>
        <TestVersionBadge />
        <div className="flex-1" />
        <ReleaseNotesButton />
        <UserMenu />
      </header>

      <main className="relative flex-1 min-h-0 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 lg:py-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] overflow-y-auto lg:overflow-hidden">
        {/* tools */}
        <section className="min-h-0 flex flex-col">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-2xl font-bold tracking-tight">Ferramentas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{firstName ? `Olá, ${firstName}! ` : ''}Escolha por onde começar.</p>
          </div>
          <div className="grid gap-3 mt-5 sm:grid-cols-2 flex-1 min-h-0 content-start lg:auto-rows-fr">
            {TOOLS.map((tool, i) => {
              const soon = tool.available === false;
              return (
                <button
                  key={tool.id}
                  onClick={() => openTool(tool)}
                  disabled={soon}
                  style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'both' }}
                  className={cn('group relative text-left rounded-2xl border bg-card/90 backdrop-blur p-5 flex flex-col gap-3 min-h-0 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in slide-in-from-bottom-3 duration-500',
                    soon ? 'opacity-60 cursor-default' : 'hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10')}
                >
                  {(tool.novo || soon) && (
                    <span className={cn('absolute top-3.5 right-3.5 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1',
                      soon ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary)/0.8)]')}>
                      {soon ? 'Em breve' : 'Novo'}
                    </span>
                  )}
                  <div className={cn('transition-transform duration-300 w-fit', soon ? 'grayscale' : 'group-hover:scale-105 group-hover:-rotate-2')}><ToolArt id={tool.id} /></div>
                  <div className="space-y-1 flex-1 min-h-0">
                    <h2 className="text-lg font-bold group-hover:text-primary transition-colors">{tool.title}</h2>
                    <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">{tool.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tool.tags.map((t) => (
                      <span key={t} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">{t}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* projects */}
        <ProjectsPanel />
      </main>

      <ProjectPicker open={!!pickingFor} onOpenChange={(o) => !o && setPickingFor(null)} toolName={pickingFor?.title}
        onPick={(id) => { const panel = pickingFor?.projectPanel; setPickingFor(null); navigate(`/project/${id}/${panel}`); }} />
    </div>
  );
}

const TABS: { id: ProjectTab; label: string; icon: typeof Clock3; empty: string }[] = [
  { id: 'recentes', label: 'Recentes', icon: Clock3, empty: 'Os projetos que você abrir aparecem aqui.' },
  { id: 'meus', label: 'Meus', icon: UserRound, empty: 'Você ainda não criou projetos. Os que você criar ficam aqui.' },
  { id: 'todos', label: 'Todos', icon: FolderOpen, empty: 'Nenhum projeto ainda.' },
];

/** The agency's projects: recent, mine, all — in a panel whose list scrolls on its own. */
function ProjectsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const lists = useProjectLists();
  const { data: colors } = useBrandColors();
  const { create, creating } = useCreateProjectByName();
  const [tab, setTab] = useState<ProjectTab>('recentes');
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const source = q.trim() ? lists.todos : lists[tab];
  const items = source.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <section className="min-h-[420px] lg:min-h-0 flex flex-col rounded-2xl border bg-card/80 backdrop-blur overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
      <div className="p-4 pb-3 space-y-3 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex-1">Projetos</h2>
          {can('create_project') && (
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>
          )}
        </div>
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
                  {tab === t.id && <motion.span layoutId="home-projects-tab" className="absolute inset-0 rounded-md bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <Icon className="h-3.5 w-3.5 relative" />
                  <span className="relative">{t.label}</span>
                  <span className="relative opacity-60 tabular-nums">{lists[t.id].length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div key={q ? 'q' : tab} className="flex-1 min-h-0 overflow-y-auto p-2 animate-in fade-in duration-200">
        {lists.isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10 px-6">{q ? 'Nenhum projeto com esse nome.' : TABS.find((t) => t.id === tab)?.empty}</p>
        ) : (
          <div className="space-y-0.5 stagger">
            {items.map((p) => (
              <button key={p.id} onClick={() => navigate(`/project/${p.id}/tasks`)}
                className="group w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-secondary">
                <ProjectAvatar id={p.id} name={p.name} color={colors?.[p.id]} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold min-w-0">
                    <span className="truncate" title={p.name}>{p.name}</span>
                    {isMine(p, user?.id) && <Star className="h-3 w-3 text-primary fill-primary flex-none" aria-label="Criado por você" />}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {p.updated_at ? `atualizado ${formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: ptBR })}` : 'projeto'}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Um projeto por cliente ou marca (ex.: Spasso Splash). As tarefas — como “Solicitação de Banners” — ficam dentro dele.</DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => { e.preventDefault(); const id = await create(newName); if (id) { setNewOpen(false); setNewName(''); navigate(`/project/${id}/generate`); } }} className="flex gap-2">
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do cliente ou marca" className="bg-secondary" />
            <Button type="submit" disabled={!newName.trim() || creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
