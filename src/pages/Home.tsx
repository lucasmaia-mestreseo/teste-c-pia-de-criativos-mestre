import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Plus, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import UserMenu from '@/components/UserMenu';
import ToolArt from '@/components/ToolArt';
import { TOOLS, type ToolDefinition } from '@/lib/tools';
import { useProjects } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

/** Stable, brand-friendly color per project (for the initials avatar). */
function projectColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${(58 + (h % 7) * 12) % 360} 90% 62%)`;
}

/** Tools hub — the first screen after login. */
export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: allProjects } = useProjects();
  const { canAccessProject } = usePermissions();
  const [pickingFor, setPickingFor] = useState<ToolDefinition | null>(null);

  const projects = (allProjects || [])
    .filter((p) => p.active !== false && canAccessProject(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const recent = [...projects]
    .sort((a, b) => (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? ''))
    .slice(0, 4);

  const firstName = profile?.name?.split(' ')[0];

  const openTool = (tool: ToolDefinition) => {
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
        <div className="flex-1" />
        <UserMenu />
      </header>

      <main className="relative flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1 animate-in fade-in duration-700">
          {firstName ? `Olá, ${firstName}! ` : ''}Escolha por onde começar.
        </p>

        <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <button
              key={tool.id}
              onClick={() => openTool(tool)}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              className="group text-left rounded-2xl border bg-card/90 backdrop-blur p-5 flex flex-col gap-4 transition-all duration-300 hover:border-primary/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              <div className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2 w-fit"><ToolArt id={tool.id} /></div>
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
          ))}

          <div style={{ animationDelay: `${TOOLS.length * 80}ms`, animationFillMode: 'both' }} className="rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[240px] animate-in fade-in duration-500">
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-base font-bold">Mais ferramentas em breve!</h2>
            <p className="text-sm text-muted-foreground max-w-[220px]">Tem ideia de ferramenta? Manda pro time de produto.</p>
          </div>
        </div>

        {recent.length > 0 && (
          <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-700" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3"><Clock3 className="h-4 w-4" /> Continue de onde parou</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {recent.map((p) => (
                <button key={p.id} onClick={() => navigate(`/project/${p.id}/generate`)}
                  className="group flex items-center gap-3 rounded-xl border bg-card/80 p-3 text-left transition-all hover:border-primary/50 hover:bg-card">
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground flex-none" style={{ background: projectColor(p.id) }}>
                    {p.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.updated_at ? formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: ptBR }) : 'Projeto'}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Project picker for tools that work inside a project */}
      <Dialog open={!!pickingFor} onOpenChange={(o) => !o && setPickingFor(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{pickingFor?.title}</DialogTitle>
            <DialogDescription>Escolha o projeto (cliente) para usar o brand kit certo.</DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Buscar projeto..." />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    const panel = pickingFor?.projectPanel;
                    setPickingFor(null);
                    navigate(`/project/${p.id}/${panel}`);
                  }}
                  className="cursor-pointer"
                >
                  {p.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
