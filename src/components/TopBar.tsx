import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, Clock, Plus, Zap, FileText, Shield, FileCode, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

type RightPanel = 'generate' | 'brandkit' | 'context' | 'history';

interface TopBarProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  activePanel: RightPanel;
  onPanelChange: (panel: RightPanel) => void;
}

export default function TopBar({ selectedProjectId, onSelectProject, activePanel, onPanelChange }: TopBarProps) {
  const { data: projects } = useProjects();
  const createProject = useCreateProject();
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const canCreateProject = role === 'owner' || role === 'admin' || role === 'manager';
  const canManageUsers = role === 'owner' || role === 'admin';
  const canEditPrompts = role === 'owner';

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

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b bg-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary fill-primary" />
          <h1 className="text-lg font-bold tracking-tight">Clonador Mestre</h1>
        </div>

        <Select value={selectedProjectId ?? ''} onValueChange={onSelectProject}>
          <SelectTrigger className="w-[200px] bg-secondary border-border">
            <SelectValue placeholder="Selecione um projeto" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canCreateProject && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost"><Plus className="h-4 w-4" /></Button>
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

      <div className="flex items-center gap-1">
        <Button
          variant={activePanel === 'generate' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onPanelChange('generate')}
        >
          <Zap className="h-4 w-4 mr-1" /> Gerar
        </Button>
        <Button
          variant={activePanel === 'brandkit' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onPanelChange('brandkit')}
        >
          <Palette className="h-4 w-4 mr-1" /> Brand Kit
        </Button>
        <Button
          variant={activePanel === 'context' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onPanelChange('context')}
        >
          <FileText className="h-4 w-4 mr-1" /> Contexto
        </Button>
        <Button
          variant={activePanel === 'history' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onPanelChange('history')}
        >
          <Clock className="h-4 w-4 mr-1" /> Histórico
        </Button>

        <div className="ml-3 border-l pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="text-xs max-w-[120px] truncate">{profile?.name || 'Usuário'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{role || 'Sem nível'}</p>
              </div>
              <DropdownMenuSeparator />
              {canManageUsers && (
                <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                  <Shield className="h-4 w-4 mr-2" /> Gerenciar Usuários
                </DropdownMenuItem>
              )}
              {canEditPrompts && (
                <DropdownMenuItem onClick={() => navigate('/admin/prompts')}>
                  <FileCode className="h-4 w-4 mr-2" /> Editar Prompts
                </DropdownMenuItem>
              )}
              {(canManageUsers || canEditPrompts) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
