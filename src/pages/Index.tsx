import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import GeneratePanel from '@/components/GeneratePanel';
import GenerationControls from '@/components/GenerationControls';
import BrandKitPanel from '@/components/BrandKitPanel';
import ContextPanel from '@/components/ContextPanel';
import HistoryPanel from '@/components/HistoryPanel';
import type { FreePromptData } from '@/components/FreePromptPanel';
import type { TemplateData } from '@/components/TemplatesPanel';
import type { CreationMode } from '@/components/CreationModeSelector';
import DashboardPanel from '@/components/DashboardPanel';
import DynamicGeneratePanel from '@/components/DynamicGeneratePanel';
import DynamicResultsPanel from '@/components/DynamicResultsPanel';
import CreativesPanel from '@/components/CreativesPanel';
import UnfoldPanel from '@/components/UnfoldPanel';
import UnfoldResultsPanel from '@/components/UnfoldResultsPanel';
import { VIDEO_ENABLED } from '@/lib/tools';
// Criação de KVs is heavy (38-page template, PDF/vector tools): loaded only when opened
const KvStudio = lazy(() => import('@/components/kv/KvStudio'));
const VideoStudio = lazy(() => import('@/components/video/VideoStudio'));
import ProjectOnboarding from '@/components/ProjectOnboarding';
import ProjectStart from '@/components/ProjectStart';
import TasksPanel from '@/components/TasksPanel';
import { useProject } from '@/hooks/useProject';
import { useAuth } from '@/contexts/AuthContext';
import { touchRecentProject } from '@/lib/projectLists';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type RightPanel = 'tasks' | 'generate' | 'brandkit' | 'context' | 'history' | 'dynamic' | 'creatives' | 'unfold' | 'kv' | 'video';

const VALID_PANELS: RightPanel[] = ['tasks', 'generate', 'brandkit', 'context', 'history', 'dynamic', 'creatives', 'unfold', 'kv', ...(VIDEO_ENABLED ? ['video' as const] : [])];

const EMPTY_FREE_PROMPT: FreePromptData = { prompt: '', attachedImages: [] };
const EMPTY_TEMPLATE: TemplateData = { templateId: null, fields: {}, prompt: '', attachedImages: [] };

const Index = () => {
  const { projectId: urlProjectId, panel: urlPanel } = useParams<{ projectId?: string; panel?: string }>();
  const navigate = useNavigate();

  const [projectId, setProjectId] = useState<string | null>(urlProjectId ?? null);
  const [activePanel, setActivePanel] = useState<RightPanel>(
    VALID_PANELS.includes(urlPanel as RightPanel) ? (urlPanel as RightPanel) : 'generate'
  );
  const [selectedSwipe, setSelectedSwipe] = useState<Tables<'swipe_files'> | null>(null);
  const [creationMode, setCreationMode] = useState<CreationMode>('free');
  const [freePromptData, setFreePromptData] = useState<FreePromptData>(EMPTY_FREE_PROMPT);
  const [templateData, setTemplateData] = useState<TemplateData>(EMPTY_TEMPLATE);
  const [generating, setGenerating] = useState(false);
  const [dynamicGenerating, setDynamicGenerating] = useState(false);
  const [unfoldPending, setUnfoldPending] = useState<string[]>([]);

  const project = useProject(projectId);
  const { user } = useAuth();
  const onboardingPending = !!(projectId && project.data && !project.data.onboarding_completed);
  // the onboarding (Brand Kit + contexto) only gates generation: KV, Desdobramento and the gallery work right away
  const showOnboarding = onboardingPending && (activePanel === 'generate' || activePanel === 'dynamic');
  // new projects first choose how to start; the Brand Kit step-by-step opens only if they pick it
  const [brandKitChosen, setBrandKitChosen] = useState<string | null>(null);

  // "Últimos editados" on the home screen
  useEffect(() => { if (projectId) touchRecentProject(user?.id, projectId); }, [projectId, user?.id]);

  const resetProjectState = () => {
    setSelectedSwipe(null);
    setFreePromptData(EMPTY_FREE_PROMPT);
    setTemplateData(EMPTY_TEMPLATE);
  };

  // Sync URL → state when URL params change (including the browser back/forward buttons)
  useEffect(() => {
    if (urlProjectId && urlProjectId !== projectId) {
      setProjectId(urlProjectId);
      resetProjectState();
    }
    if (!urlProjectId && projectId) {
      // Back to "/criativos" → show the dashboard again
      setProjectId(null);
    }
    if (urlPanel && VALID_PANELS.includes(urlPanel as RightPanel) && urlPanel !== activePanel) {
      setActivePanel(urlPanel as RightPanel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, urlPanel]);

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    resetProjectState();
    // switching project keeps you in the same tool
    navigate(`/project/${id}/${activePanel}`);
  };

  const handlePanelChange = (panel: RightPanel) => {
    setActivePanel(panel);
    if (projectId) {
      navigate(`/project/${projectId}/${panel}`);
    }
  };

  const handleOnboardingComplete = () => {
    setActivePanel('tasks');
    if (projectId) navigate(`/project/${projectId}/tasks`, { state: { newTask: true } });
  };

  const handleUseAsReference = useCallback((imageUrl: string, refProjectId?: string) => {
    const targetProject = refProjectId || projectId;
    if (refProjectId && refProjectId !== projectId) {
      setProjectId(refProjectId);
    }
    setCreationMode('free');
    setFreePromptData({ prompt: '', attachedImages: [imageUrl] });
    setActivePanel('generate');
    if (targetProject) {
      navigate(`/project/${targetProject}/generate`);
    }
    toast.success('Imagem adicionada como referência');
  }, [projectId, navigate]);

  const handleGoToDashboard = () => {
    setProjectId(null);
    navigate('/criativos');
  };

  const showDashboard = !projectId;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        selectedProjectId={projectId}
        onSelectProject={handleProjectChange}
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
        onboardingPending={onboardingPending}
        onGoToDashboard={handleGoToDashboard}
      />

      <div className="flex flex-1 overflow-hidden">
        {showDashboard ? (
          <div className="flex-1 overflow-hidden">
            <DashboardPanel onSelectProject={handleProjectChange} onUseAsReference={handleUseAsReference} />
          </div>
        ) : showOnboarding ? (
          brandKitChosen === projectId
            ? <ProjectOnboarding projectId={projectId!} onComplete={handleOnboardingComplete} />
            : <ProjectStart projectId={projectId!} projectName={project.data?.name} onCreateBrandKit={() => setBrandKitChosen(projectId)} />
        ) : (
          <>
            {activePanel === 'generate' && (
              <div className="w-[35%] max-w-[560px] border-r bg-card flex-shrink-0 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                <GenerationControls
                  projectId={projectId!}
                  creationMode={creationMode}
                  onCreationModeChange={setCreationMode}
                  selectedSwipe={selectedSwipe}
                  onSelectSwipe={setSelectedSwipe}
                  freePromptData={freePromptData}
                  onFreePromptDataChange={setFreePromptData}
                  templateData={templateData}
                  onTemplateDataChange={setTemplateData}
                  onGeneratingChange={setGenerating}
                />
              </div>
            )}

            {activePanel === 'dynamic' && (
              <div className="w-[35%] max-w-[560px] border-r bg-card flex-shrink-0 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                <DynamicGeneratePanel projectId={projectId} onGeneratingChange={setDynamicGenerating} />
              </div>
            )}

            {activePanel === 'unfold' && (
              <div className="w-[35%] max-w-[560px] border-r bg-card flex-shrink-0 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                <UnfoldPanel projectId={projectId!} onPendingChange={setUnfoldPending} />
              </div>
            )}

            {/* key → each tab fades in (CSS, never blocks the next tab from mounting) */}
            <div key={activePanel} className="flex-1 bg-background overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300">
              {activePanel === 'generate' && (
                <GeneratePanel
                  projectId={projectId}
                  generating={generating}
                  onUseAsReference={handleUseAsReference}
                />
              )}
              {activePanel === 'tasks' && <TasksPanel projectId={projectId!} />}
              {activePanel === 'brandkit' && <BrandKitPanel projectId={projectId} />}
              {activePanel === 'context' && <ContextPanel projectId={projectId} />}
              {activePanel === 'history' && <HistoryPanel projectId={projectId} />}
              {activePanel === 'dynamic' && <DynamicResultsPanel projectId={projectId} generating={dynamicGenerating} onUseAsReference={handleUseAsReference} />}
              {activePanel === 'creatives' && <CreativesPanel projectId={projectId} onUseAsReference={handleUseAsReference} />}
              {activePanel === 'kv' && (
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                  <KvStudio projectId={projectId!} />
                </Suspense>
              )}
              {activePanel === 'video' && (
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
                  <VideoStudio projectId={projectId!} />
                </Suspense>
              )}
              {activePanel === 'unfold' && <UnfoldResultsPanel projectId={projectId!} pending={unfoldPending} onUseAsReference={handleUseAsReference} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
