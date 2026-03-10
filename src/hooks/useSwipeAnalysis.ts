import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface SwipeAnalysis {
  texts: { id: string; content: string; position: string; role: string }[];
  logos: { id: string; position: string; description: string }[];
  photos: { id: string; position: string; description: string }[];
}

export function useSwipeAnalysis(swipeFile: { id: string; image_url: string; analysis?: any } | null) {
  const [analysis, setAnalysis] = useState<SwipeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const qc = useQueryClient();

  // Reset when swipe changes
  useEffect(() => {
    if (!swipeFile) {
      setAnalysis(null);
      return;
    }
    // If already analyzed, use cached
    if (swipeFile.analysis) {
      setAnalysis(swipeFile.analysis as SwipeAnalysis);
    } else {
      setAnalysis(null);
    }
  }, [swipeFile?.id, swipeFile?.analysis]);

  const analyze = useCallback(async () => {
    if (!swipeFile) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-swipe', {
        body: { swipeFileUrl: swipeFile.image_url, swipeFileId: swipeFile.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      // Invalidate swipe files query so the cached analysis is picked up
      qc.invalidateQueries({ queryKey: ['swipe_files'] });
      toast.success('Análise concluída!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao analisar imagem');
    } finally {
      setAnalyzing(false);
    }
  }, [swipeFile?.id, swipeFile?.image_url, qc]);

  return { analysis, analyzing, analyze };
}
