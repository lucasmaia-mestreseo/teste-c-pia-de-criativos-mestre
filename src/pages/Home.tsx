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

/** Tools hub — the first screen after login. */
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
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* soft brand glow behind the title */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full bg-primary/10 blur-[120px]" />
      <header className="relative h-12 border-b bg-card/80 backdrop-blur flex items-center px-4 gap-2 flex-shrink-0">
        <Zap className="h-4 w-4 text-primary fill-primary" />
        <span className="text-sm font-bold tracking-tight">Criativos Mestre</span>
        <TestVersionBadge />
        <div className="flex-1" />
        <ReleaseNotesButton />
        <UserMenu />
      </header>

      <main className="relative flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1 animate-in fade-in duration-700">
          {firstName ? `Olá, ${firstName}! ` : ''}Escolha por onde começar.
        </p>

        <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool, i) => {
            const soon = tool.available === false;
            return (
              <button
                key={tool.id}
                onClick={() => openTool(tool)}
                disabled={soon}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                className={`group relative text-left rounded-2xl border bg-card/90 backdrop-blur p-5 flex flex-col gap-4 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in slide-in-from-bottom-3 duration-500 ${soon ? 'opacity-60 cursor-default' : 'hover:border-primary/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10'}`}
              >
                {(tool.novo || soon) && (
                  <span className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${soon ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary)/0.8)]'}`}>
                    {soon ? 'Em breve' : 'Novo'}
                  </span>
                )}
                <div className={`transition-transform duration-300 w-fit ${soon ? 'grayscale' : 'group-hover:scale-105 group-hover:-rotate-2'}`}><ToolArt id={tool.id} /></div>
                <div className="space-y-1.5 flex-1">
                  <h2 className="text-lg font-bold group-hover:text-primary transition-colors">{tool.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tool.tags.map((t) => (
                    <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{t}</span>
                  ))}
                </div>
              </button>
            );
          })}

          <div style={{ animationDelay: `${TOOLS.length * 80}ms`, animationFillMode: 'both' }} className="rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[240px] animate-in fade-in duration-500">
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-base font-bold">Mais ferramentas em breve!</h2>
            <p className="text-sm text-muted-foreground max-w-[220px]">Tem ideia de ferramenta? Manda pro time de produto.</p>
          </div>
        </div>

        <ProjectsSection />
      </main>

      <ProjectPicker open={!!pickingFor} onOpenChange={(o) => !o && setPickingFor(null)} toolName={pickingFor?.title}
        onPick={(id) => { const panel = pickingFor?.projectPanel; setPickingFor(null); navigate(`/project/${id}/${panel}`); }} />
    </div>
  );
}

const SECTION_TABS: { id: ProjectTab; label: string; icon: typeof Clock3; empty: string }[] = [
  { id: 'recentes', label: 'Últimos editados', icon: Clock3, empty: 'Os projetos que você abrir aparecem aqui.' },
  { id: 'meus', label: 'Meus projetos', icon: UserRound, empty: 'Você ainda não criou projetos. Os que você criar ficam aqui.' },
  { id: 'todos', label: 'Todos os projetos', icon: FolderOpen, empty: 'Nenhum projeto ainda.' },
];

/** Projects of the agency, organized: recent, mine, all. */
function ProjectsSection() {
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
  const shown = tab === 'todos' || q.trim() ? items : items.slice(0, 8);

  return (
    <section className="mt-12 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold mr-2">Projetos</h2>
        <div className="flex items-center gap-1 rounded-full border bg-card p-1">
          {SECTION_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setQ(''); }}
                className={cn('relative flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors', tab === t.id && !q ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {tab === t.id && !q && <motion.span layoutId="home-projects-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Icon className="h-3.5 w-3.5 relative" />
                <span className="relative hidden sm:inline">{t.label}</span>
                <span className="relative opacity-60 tabular-nums">{lists[t.id].length}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar projeto" className="h-8 pl-8 text-xs bg-card" />
        </div>
        {can('create_project') && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>
        )}
      </div>

      {lists.isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q ? 'Nenhum projeto com esse nome.' : SECTION_TABS.find((t) => t.id === tab)?.empty}
        </div>
      ) : (
        <div key={q ? 'q' : tab} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {shown.map((p) => (
            <button key={p.id} onClick={() => navigate(`/project/${p.id}/generate`)}
              className="group flex items-center gap-3 rounded-xl border bg-card/80 p-3 text-left transition-all duration-200 hover:border-primary/50 hover:bg-card hover:-translate-y-0.5">
              <ProjectAvatar id={p.id} name={p.name} color={colors?.[p.id]} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold truncate">
                  <span className="truncate">{p.name}</span>
                  {isMine(p, user?.id) && <Star className="h-3 w-3 text-primary fill-primary flex-none" aria-label="Criado por você" />}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {p.updated_at ? formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: ptBR }) : 'Projeto'}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
      {tab !== 'todos' && !q && items.length > shown.length && (
        <button onClick={() => setTab('todos')} className="text-xs text-primary hover:underline">Ver todos os {lists.todos.length} projetos</button>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Um projeto por cliente ou marca. Depois você completa o Brand Kit e o contexto — ou cria o manual em Criação de KVs.</DialogDescription>
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
