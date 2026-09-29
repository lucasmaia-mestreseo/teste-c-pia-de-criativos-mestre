import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { useRenameProject } from '@/hooks/useProject';
import { usePermissions } from '@/hooks/usePermissions';
import UserMenu from '@/components/UserMenu';
import { Palette, Clock, Plus, Zap, FileText, Sparkles, Image, Check, ChevronsUpDown, Pencil, Layers, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import type { RightPanel } from '@/pages/Index';

interface TopBarProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  activePanel: RightPanel;
  onPanelChange: (panel: RightPanel) => void;
  onboardingPending?: boolean;
  onGoToDashboard?: () => void;
}

export default function TopBar({ selectedProjectId, onSelectProject, activePanel, onPanelChange, onboardingPending, onGoToDashboard }: TopBarProps) {
  const { data: allProjects } = useProjects();
  const { canAccessProject, can } = usePermissions();
  const projects = allProjects?.filter((p) => canAccessProject(p.id));
  const createProject = useCreateProject();
  const renameProject = useRenameProject();
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [projectsOpen, setProjectsOpen] = useState('');

  const canCreateProject = can('create_project');

  const nameExists = (name: string, ignoreId?: string) => {
    const n = name.trim().toLowerCase();
    return (allProjects || []).some((p) => p.name.trim().toLowerCase() === n && p.id !== ignoreId);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (nameExists(name)) {
      toast.error('Já existe um projeto com esse nome');
      return;
    }
    try {
      const p = await createProject.mutateAsync({ name });
      onSelectProject(p.id);
      setNewName('');
      setDialogOpen(false);
      toast.success('Projeto criado!');
    } catch (e: any) {
      toast.error(e?.code === '23505' ? 'Já existe um projeto com esse nome' : 'Erro ao criar projeto');
    }
  };

  const handleRename = async () => {
    const name = renameName.trim();
    if (!name || !selectedProjectId) return;
    if (nameExists(name, selectedProjectId)) {
      toast.error('Já existe um projeto com esse nome');
      return;
    }
    try {
      await renameProject.mutateAsync({ id: selectedProjectId, name });
      setRenameDialogOpen(false);
      toast.success('Projeto renomeado!');
    } catch (e: any) {
      toast.error(e?.code === '23505' ? 'Já existe um projeto com esse nome' : 'Erro ao renomear projeto');
    }
  };

  const openRenameDialog = () => {
    const currentName = projects?.find((p) => p.id === selectedProjectId)?.name || '';
    setRenameName(currentName);
    setRenameDialogOpen(true);
  };

  const navItems: { panel: RightPanel; icon: React.ElementType; label: string }[] = [
    { panel: 'generate', icon: Zap, label: 'Gerar' },
    { panel: 'dynamic', icon: Sparkles, label: 'Dinâmica' },
    { panel: 'unfold', icon: Layers, label: 'Desdobramento' },
    { panel: 'creatives', icon: Image, label: 'Criativos' },
    { panel: 'brandkit', icon: Palette, label: 'Brand Kit' },
    { panel: 'context', icon: FileText, label: 'Contexto' },
    { panel: 'history', icon: Clock, label: 'Histórico' },
  ];

  return (
    <header className="h-12 border-b bg-card flex items-center px-3 gap-2 flex-shrink-0">
      {/* Back to the tools hub */}
      <button
        onClick={() => navigate('/')}
        className="p-1 -ml-1 rounded-md text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
        title="Voltar às ferramentas"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Logo */}
      <button
        onClick={onGoToDashboard}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity mr-2 flex-shrink-0"
      >
        <Zap className="h-4 w-4 text-primary fill-primary" />
        <span className="text-sm font-bold tracking-tight whitespace-nowrap">Criativos Mestre</span>
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-border flex-shrink-0" />

      {/* Project selector */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Popover open={projectsOpen === 'open'} onOpenChange={(open) => setProjectsOpen(open ? 'open' : '')}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-[170px] h-8 text-[11px] bg-secondary border-border justify-between font-normal">
              <span className="truncate">
                {selectedProjectId
                  ? projects?.find((p) => p.id === selectedProjectId)?.name ?? 'Selecione um projeto'
                  : 'Selecione um projeto'}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar projeto..." className="h-8 text-[11px]" />
              <CommandEmpty className="text-[11px] py-4">Nenhum projeto encontrado.</CommandEmpty>
              <CommandList>
                {projects?.filter((p: any) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      onSelectProject(p.id);
                      setProjectsOpen('');
                    }}
                    className="text-[11px] gap-2"
                  >
                    <Check className={cn("h-3 w-3", selectedProjectId === p.id ? "opacity-100" : "opacity-0")} />
                    {p.name}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {canCreateProject && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do projeto"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="bg-secondary"
                />
                <Button onClick={handleCreate} disabled={createProject.isPending}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedProjectId && can('edit_project') && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={openRenameDialog}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
              <DialogContent className="bg-card">
                <DialogHeader><DialogTitle>Renomear Projeto</DialogTitle></DialogHeader>
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo nome do projeto"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    className="bg-secondary"
                  />
                  <Button onClick={handleRename} disabled={renameProject.isPending}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border flex-shrink-0" />

      {/* Navigation */}
      {selectedProjectId && (
        <nav className="flex items-center gap-0.5 flex-1 min-w-0">
          {navItems.map(({ panel, icon: Icon, label }) => (
            <button
              key={panel}
              onClick={() => !onboardingPending && onPanelChange(panel)}
              disabled={onboardingPending}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                onboardingPending
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : activePanel === panel
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-primary hover:border-primary border border-transparent'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      )}

      {!selectedProjectId && <div className="flex-1" />}

      <UserMenu />
    </header>
  );
}
