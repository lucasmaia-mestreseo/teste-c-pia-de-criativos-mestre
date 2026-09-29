import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import UserMenu from '@/components/UserMenu';
import ToolArt from '@/components/ToolArt';
import { TOOLS, type ToolDefinition } from '@/lib/tools';
import { useProjects } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

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

  const firstName = profile?.name?.split(' ')[0];

  const openTool = (tool: ToolDefinition) => {
    if (tool.path) navigate(tool.path);
    else if (tool.projectPanel) setPickingFor(tool);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-12 border-b bg-card flex items-center px-4 gap-2 flex-shrink-0">
        <Zap className="h-4 w-4 text-primary fill-primary" />
        <span className="text-sm font-bold tracking-tight">Criativos Mestre</span>
        <div className="flex-1" />
        <UserMenu />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {firstName ? `Olá, ${firstName}! ` : ''}Escolha por onde começar.
        </p>

        <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => openTool(tool)}
              className="group text-left rounded-2xl border bg-card p-5 flex flex-col gap-4 transition-all hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ToolArt id={tool.id} />
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

          <div className="rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[240px]">
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-base font-bold">Mais ferramentas em breve!</h2>
            <p className="text-sm text-muted-foreground max-w-[220px]">Tem ideia de ferramenta? Manda pro time de produto.</p>
          </div>
        </div>
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
