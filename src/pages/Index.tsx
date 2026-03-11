import { useState } from 'react';
import TopBar from '@/components/TopBar';
import SwipeFilePanel from '@/components/SwipeFilePanel';
import GeneratePanel from '@/components/GeneratePanel';
import BrandKitPanel from '@/components/BrandKitPanel';
import ContextPanel from '@/components/ContextPanel';
import HistoryPanel from '@/components/HistoryPanel';
import FreePromptPanel, { type FreePromptData } from '@/components/FreePromptPanel';
import TemplatesPanel, { type TemplateData } from '@/components/TemplatesPanel';
import CreationModeSelector, { type CreationMode } from '@/components/CreationModeSelector';
import type { Tables } from '@/integrations/supabase/types';

type RightPanel = 'generate' | 'brandkit' | 'context' | 'history';

const Index = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>('generate');
  const [selectedSwipe, setSelectedSwipe] = useState<Tables<'swipe_files'> | null>(null);
  const [creationMode, setCreationMode] = useState<CreationMode>('swipe');
  const [freePromptData, setFreePromptData] = useState<FreePromptData>({ prompt: '', attachedImages: [] });
  const [templateData, setTemplateData] = useState<TemplateData>({ templateId: null, fields: {}, prompt: '', attachedImages: [] });

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setSelectedSwipe(null);
    setFreePromptData({ prompt: '', attachedImages: [] });
    setTemplateData({ templateId: null, fields: {}, prompt: '', attachedImages: [] });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        selectedProjectId={projectId}
        onSelectProject={handleProjectChange}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="w-[35%] border-r bg-card flex-shrink-0 flex flex-col">
          {projectId && (
            <CreationModeSelector mode={creationMode} onChange={setCreationMode} />
          )}
          <div className="flex-1 min-h-0">
            {creationMode === 'swipe' && (
              <SwipeFilePanel
                projectId={projectId}
                selectedSwipe={selectedSwipe}
                onSelectSwipe={setSelectedSwipe}
              />
            )}
            {creationMode === 'free' && projectId && (
              <FreePromptPanel
                projectId={projectId}
                data={freePromptData}
                onChange={setFreePromptData}
              />
            )}
            {creationMode === 'templates' && projectId && (
              <TemplatesPanel
                projectId={projectId}
                data={templateData}
                onChange={setTemplateData}
              />
            )}
            {!projectId && creationMode !== 'swipe' && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Selecione um projeto para começar</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Dynamic panel */}
        <div className="flex-1 bg-background overflow-hidden">
          {activePanel === 'generate' && (
            <GeneratePanel
              projectId={projectId}
              selectedSwipe={selectedSwipe}
              creationMode={creationMode}
              freePromptData={freePromptData}
              templateData={templateData}
            />
          )}
          {activePanel === 'brandkit' && (
            <BrandKitPanel projectId={projectId} />
          )}
          {activePanel === 'context' && (
            <ContextPanel projectId={projectId} />
          )}
          {activePanel === 'history' && (
            <HistoryPanel projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
