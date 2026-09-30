import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProjects } from '@/hooks/useProjects';
import ProjectPicker, { ProjectAvatar, useBrandColors } from '@/components/ProjectPicker';
import TestVersionBadge from '@/components/TestVersionBadge';
import TaskSelector from '@/components/TaskSelector';
import { useRenameProject } from '@/hooks/useProject';
import { usePermissions } from '@/hooks/usePermissions';
import UserMenu from '@/components/UserMenu';
import { ReleaseNotesButton } from '@/components/ReleaseNotes';
import { Palette, Clock, Zap, FileText, Sparkles, Image, ChevronsUpDown, Pencil, Layers, ChevronLeft, BookOpenCheck, Clapperboard, FolderOpen } from 'lucide-react';
import { VIDEO_ENABLED } from '@/lib/tools';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import type { RightPanel } from '@/pages/Index';

interface TopBarProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  activePanel: RightPanel;
  onPanelChange: (panel: RightPanel) => void;
  /** @deprecated the onboarding no longer locks the other tools */
  onboardingPending?: boolean;
  onGoToDashboard?: () => void;
}

export default function TopBar({ selectedProjectId, onSelectProject, activePanel, onPanelChange, onGoToDashboard }: TopBarProps) {
  const { data: allProjects } = useProjects();
  const { canAccessProject, can } = usePermissions();
  const projects = allProjects?.filter((p) => canAccessProject(p.id));
  const renameProject = useRenameProject();
  const navigate = useNavigate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: colors } = useBrandColors();
  const current = projects?.find((p) => p.id === selectedProjectId) ?? null;

  const nameExists = (name: string, ignoreId?: string) => {
    const n = name.trim().toLowerCase();
    return (allProjects || []).some((p) => p.name.trim().toLowerCase() === n && p.id !== ignoreId);
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
    { panel: 'tasks', icon: FolderOpen, label: 'Tarefas' },
    { panel: 'generate', icon: Zap, label: 'Gerar' },
    { panel: 'dynamic', icon: Sparkles, label: 'Dinâmica' },
    { panel: 'unfold', icon: Layers, label: 'Desdobramento' },
    { panel: 'kv', icon: BookOpenCheck, label: 'KVs' },
    ...(VIDEO_ENABLED ? [{ panel: 'video' as RightPanel, icon: Clapperboard, label: 'Vídeo' }] : []),
    { panel: 'creatives', icon: Image, label: 'Criativos' },
    { panel: 'brandkit', icon: Palette, label: 'Brand Kit' },
    { panel: 'context', icon: FileText, label: 'Contexto' },
    { panel: 'history', icon: Clock, label: 'Histórico' },
  ];

  return (
    <header className="glass relative z-30 h-12 border-b border-white/[0.06] flex items-center px-3 gap-2 flex-shrink-0">
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
        <span className="text-sm font-bold tracking-tight whitespace-nowrap hidden md:inline">Criativos Mestre</span>
      </button>
      <TestVersionBadge />

      {/* Separator */}
      <div className="w-px h-6 bg-border flex-shrink-0" />

      {/* Project selector */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setPickerOpen(true)}
          className="group flex items-center gap-2 h-8 max-w-[200px] rounded-lg border bg-secondary pl-1 pr-2 text-[11px] transition-colors hover:border-primary/50">
          {current
            ? <ProjectAvatar id={current.id} name={current.name} color={colors?.[current.id]} size="sm" />
            : <span className="h-6 w-6 rounded-md bg-background flex items-center justify-center"><FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /></span>}
          <span className="truncate font-medium">{current?.name ?? 'Escolha um projeto'}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
        </button>
        <ProjectPicker open={pickerOpen} onOpenChange={setPickerOpen} currentProjectId={selectedProjectId} onPick={onSelectProject} />
        {selectedProjectId && <TaskSelector projectId={selectedProjectId} />}

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
        <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {navItems.map(({ panel, icon: Icon, label }) => {
            const active = activePanel === panel;
            return (
              <button
                key={panel}
                onClick={() => onPanelChange(panel)}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-none",
                  active
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-primary hover:bg-secondary/60'
                )}
              >
                {active && (
                  <motion.span layoutId="topbar-active" className="absolute inset-0 rounded-md bg-primary shadow-sm shadow-primary/30" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                {/* labels collapse to icons on medium screens; the active tab keeps its label */}
                <span className={cn('relative', !active && 'hidden xl:inline')}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {!selectedProjectId && <div className="flex-1" />}

      <ReleaseNotesButton compact />
      <UserMenu />
    </header>
  );
}
