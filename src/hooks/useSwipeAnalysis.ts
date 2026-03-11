import { useState, useEffect } from 'react';
import type { Json } from '@/integrations/supabase/types';

export interface SwipeAnalysis {
  texts: { id: string; content: string; position: string; role: string }[];
  logos: { id: string; position: string; description: string }[];
  photos: { id: string; position: string; description: string }[];
}

export function useSwipeAnalysis(swipeFile: { id: string; image_url: string; analysis?: Json | null } | null) {
  const [analysis, setAnalysis] = useState<SwipeAnalysis | null>(null);

  useEffect(() => {
    if (!swipeFile) {
      setAnalysis(null);
      return;
    }
    if (swipeFile.analysis) {
      setAnalysis(swipeFile.analysis as unknown as SwipeAnalysis);
    } else {
      setAnalysis(null);
    }
  }, [swipeFile?.id, swipeFile?.analysis]);

  const isPending = !!swipeFile && !swipeFile.analysis;

  return { analysis, isPending };
}
