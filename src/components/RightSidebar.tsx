import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, Clock, Plus, Zap, FileText, Shield, LogOut, User, PanelLeftClose, PanelLeftOpen, Sparkles, Image } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type RightPanel = 'generate' | 'brandkit' | 'context' | 'history' | 'dynamic' | 'creatives';

interface RightSidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  activePanel: RightPanel;
  onPanelChange: (panel: RightPanel) => void;
  collapsed: boolean;
  onToggle: () => void;
  onboardingPending?: boolean;
  onGoToDashboard?: () => void;
}

export default function RightSidebar({ selectedProjectId, onSelectProject, activePanel, onPanelChange, collapsed, onToggle, onboardingPending, onGoToDashboard }: RightSidebarProps) {
  const { data: projects } = useProjects();
  const createProject = useCreateProject();
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const canCreateProject = role === 'owner' || role === 'admin' || role === 'manager';
  const canAdmin = role === 'owner' || role === 'admin';

  const userInitials = profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const p = await createProject.mutateAsync({ name: newName.trim() });
      onSelectProject(p.id);
      setNewName('');
      setDialogOpen(false);
      toast.success('Projeto criado!');
    } catch {
      toast.error('Erro ao criar projeto');
    }
  };

  const navItems: { panel: RightPanel; icon: React.ElementType; label: string }[] = [
    { panel: 'generate', icon: Zap, label: 'Gerar' },
    { panel: 'dynamic', icon: Sparkles, label: 'Geração Dinâmica' },
    { panel: 'creatives', icon: Image, label: 'Criativos' },
    { panel: 'brandkit', icon: Palette, label: 'Brand Kit' },
    { panel: 'context', icon: FileText, label: 'Contexto' },
    { panel: 'history', icon: Clock, label: 'Histórico' },
  ];

  return (
    <aside
      className={cn(
        "h-full border-r bg-card flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden",
        collapsed ? "w-[48px]" : "w-[280px]"
      )}
    >
      {collapsed ? (
        /* Collapsed sliver — just the expand icon */
        <div className="flex flex-col items-center pt-4">
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title="Abrir menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={onGoToDashboard} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Zap className="h-5 w-5 text-primary fill-primary" />
              <span className="text-lg font-bold tracking-tight whitespace-nowrap">Criativos Mestre</span>
            </button>
            <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Fechar menu">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <Separator />

          {/* Project selector */}
          <div className="px-4 py-4 space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId ?? ''} onValueChange={onSelectProject}>
              <SelectTrigger className="w-full bg-secondary border-border">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects?.filter((p: any) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="cursor-pointer hover:bg-secondary hover:text-foreground focus:bg-secondary focus:text-foreground"
                  >
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canCreateProject && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Novo Projeto
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
          </div>

          {/* Navigation - only when project selected */}
          {selectedProjectId && (
            <>
              <Separator />
              <nav className="px-3 py-3 space-y-1">
                {onboardingPending && (
                  <div className="px-3 py-1.5 mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Configurar</span>
                  </div>
                )}
                {navItems.map(({ panel, icon: Icon, label }) => (
                  <button
                    key={panel}
                    onClick={() => !onboardingPending && onPanelChange(panel)}
                    disabled={onboardingPending}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all border border-transparent",
                      onboardingPending
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : activePanel === panel
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:border-primary/50 hover:text-primary'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* User section */}
          <Separator />
          <div className="px-4 py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')}>
                  <User className="h-4 w-4 mr-2" /> Perfil
                </DropdownMenuItem>
                {canAdmin && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/admin')}>
                    <Shield className="h-4 w-4 mr-2" /> Administração
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </aside>
  );
}
