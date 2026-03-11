import { useState } from 'react';
import TopBar from '@/components/TopBar';
import SwipeFilePanel from '@/components/SwipeFilePanel';
import GeneratePanel from '@/components/GeneratePanel';
import BrandKitPanel from '@/components/BrandKitPanel';
import ContextPanel from '@/components/ContextPanel';
import HistoryPanel from '@/components/HistoryPanel';
import type { Tables } from '@/integrations/supabase/types';

type RightPanel = 'generate' | 'brandkit' | 'context' | 'history';

const Index = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>('generate');
  const [selectedSwipe, setSelectedSwipe] = useState<Tables<'swipe_files'> | null>(null);

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setSelectedSwipe(null);
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
        {/* Left column - Swipe File */}
        <div className="w-[35%] border-r bg-card flex-shrink-0">
          <SwipeFilePanel
            projectId={projectId}
            selectedSwipe={selectedSwipe}
            onSelectSwipe={setSelectedSwipe}
          />
        </div>

        {/* Right column - Dynamic panel */}
        <div className="flex-1 bg-background overflow-hidden">
          {activePanel === 'generate' && (
            <GeneratePanel projectId={projectId} selectedSwipe={selectedSwipe} />
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
