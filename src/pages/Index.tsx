import { useState, useCallback } from 'react';
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
import ProjectOnboarding from '@/components/ProjectOnboarding';
import { useProject } from '@/hooks/useProject';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type RightPanel = 'generate' | 'brandkit' | 'context' | 'history' | 'dynamic' | 'creatives';

const Index = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>('generate');
  const [selectedSwipe, setSelectedSwipe] = useState<Tables<'swipe_files'> | null>(null);
  const [creationMode, setCreationMode] = useState<CreationMode>('free');
  const [freePromptData, setFreePromptData] = useState<FreePromptData>({ prompt: '', attachedImages: [] });
  const [templateData, setTemplateData] = useState<TemplateData>({ templateId: null, fields: {}, prompt: '', attachedImages: [] });
  
  const [generating, setGenerating] = useState(false);

  const project = useProject(projectId);
  const onboardingPending = !!(projectId && project.data && !(project.data as any).onboarding_completed);

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setSelectedSwipe(null);
    setFreePromptData({ prompt: '', attachedImages: [] });
    setTemplateData({ templateId: null, fields: {}, prompt: '', attachedImages: [] });
    setActivePanel('generate');
  };

  const handleOnboardingComplete = () => {
    setActivePanel('generate');
  };

  const handleUseAsReference = useCallback((imageUrl: string, refProjectId?: string) => {
    if (refProjectId && refProjectId !== projectId) {
      setProjectId(refProjectId);
    }
    setCreationMode('free');
    setFreePromptData({ prompt: '', attachedImages: [imageUrl] });
    setActivePanel('generate');
    toast.success('Imagem adicionada como referência');
  }, [projectId]);

  const showDashboard = !projectId;

  return (
    <div className="flex h-screen overflow-hidden">
      <RightSidebar
        selectedProjectId={projectId}
        onSelectProject={handleProjectChange}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onboardingPending={onboardingPending}
        onGoToDashboard={() => setProjectId(null)}
      />

      <div className="flex flex-1 overflow-hidden">
        {showDashboard ? (
          <div className="flex-1 overflow-hidden">
            <DashboardPanel onSelectProject={handleProjectChange} onUseAsReference={handleUseAsReference} />
          </div>
        ) : onboardingPending ? (
          <ProjectOnboarding projectId={projectId!} onComplete={handleOnboardingComplete} />
        ) : (
          <>
            {/* Left column — generation controls */}
            {activePanel === 'generate' && (
              <div className="w-[35%] border-r bg-card flex-shrink-0 flex flex-col">
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
              <div className="w-[35%] border-r bg-card flex-shrink-0 flex flex-col">
                <DynamicGeneratePanel projectId={projectId} />
              </div>
            )}

            {/* Right column */}
            <div className="flex-1 bg-background overflow-hidden">
              {activePanel === 'generate' && (
                <GeneratePanel
                  projectId={projectId}
                  generating={generating}
                  onUseAsReference={handleUseAsReference}
                />
              )}
              {activePanel === 'brandkit' && <BrandKitPanel projectId={projectId} />}
              {activePanel === 'context' && <ContextPanel projectId={projectId} />}
              {activePanel === 'history' && <HistoryPanel projectId={projectId} />}
              {activePanel === 'dynamic' && <DynamicResultsPanel projectId={projectId} onUseAsReference={handleUseAsReference} />}
              {activePanel === 'creatives' && <CreativesPanel projectId={projectId} onUseAsReference={handleUseAsReference} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
