import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useSwipeAnalysis } from '@/hooks/useSwipeAnalysis';
import SwipeElementsEditor, { type ElementOverrides } from '@/components/SwipeElementsEditor';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Download, Trash2, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';

const FORMATS = ['9:16', '4:5', '1:1', '16:9'] as const;

const EMPTY_OVERRIDES: ElementOverrides = { texts: {}, logos: {}, photos: {} };

interface GeneratePanelProps {
  projectId: string | null;
  selectedSwipe: Tables<'swipe_files'> | null;
}

export default function GeneratePanel({ projectId, selectedSwipe }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<string>('1:1');
  const [generating, setGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [includePersonPhoto, setIncludePersonPhoto] = useState(false);
  const [selectedPersonPhoto, setSelectedPersonPhoto] = useState<string>('');
  const [thumbSize, setThumbSize] = useState(80);
  const [modalImage, setModalImage] = useState<{ url: string; prompt: string; id: string; projectId: string } | null>(null);
  const [elementOverrides, setElementOverrides] = useState<ElementOverrides>(EMPTY_OVERRIDES);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const { data: brandKit } = useBrandKit(projectId);
  const deleteCreative = useDeleteCreative();
  const qc = useQueryClient();

  const { analysis, isPending } = useSwipeAnalysis(selectedSwipe as any);

  const { data: projectData } = useQuery({
    queryKey: ['project-context', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('context')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
  const projectContext = projectData?.context ?? '';

  // Reset overrides when switching swipe files
  useEffect(() => {
    setElementOverrides(EMPTY_OVERRIDES);
  }, [selectedSwipe?.id]);

  const hasLogo = !!brandKit?.logo_url;
  const personPhotos = brandKit?.people_photos?.filter(Boolean) ?? [];
  const hasPersonPhotos = personPhotos.length > 0;

  const handleGenerate = async () => {
    if (!projectId || !selectedSwipe || !prompt.trim()) {
      toast.error('Selecione um criativo base e escreva um prompt');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          prompt: prompt.trim(),
          format,
          swipeFileId: selectedSwipe.id,
          swipeFileUrl: selectedSwipe.image_url,
          projectId,
          brandKit: brandKit ? {
            primaryColor: brandKit.primary_color,
            secondaryColor: brandKit.secondary_color,
            backgroundColor: brandKit.background_color,
            auxColors: brandKit.aux_colors,
            typography: brandKit.typography,
            logoUrl: includeLogo && hasLogo ? brandKit.logo_url : null,
            personPhotoUrl: includePersonPhoto && selectedPersonPhoto ? selectedPersonPhoto : null,
          } : null,
          elementOverrides: analysis ? elementOverrides : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Criativo gerado com sucesso!');
      qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
      setPrompt('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar criativo');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Erro no download');
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* === GALLERY (top) === */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {(creatives && creatives.length > 0 || generating) && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Resultados</h3>
              <div className="flex items-center gap-1.5">
                <Minimize2 className="h-3 w-3 text-muted-foreground" />
                <Slider
                  value={[thumbSize]}
                  onValueChange={([v]) => setThumbSize(v)}
                  min={48}
                  max={160}
                  step={8}
                  className="w-16"
                />
                <Maximize2 className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 px-3 pb-2">
            {generating && (
              <div
                className="generating-pulse rounded-md bg-secondary flex-shrink-0 flex items-center justify-center border"
                style={{ width: thumbSize, height: thumbSize }}
              >
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            {creatives?.map((c) => (
              <div
                key={c.id}
                className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0 cursor-pointer"
                style={{ width: thumbSize, height: thumbSize }}
                onClick={() => setModalImage({ url: c.image_url, prompt: c.prompt, id: c.id, projectId: c.project_id })}
              >
                <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(c.image_url, `creative-${c.id}.png`); }}
                    className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCreative.mutate({ id: c.id, projectId: c.project_id }); }}
                    className="p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      {/* === IMAGE MODAL === */}
      <Dialog open={!!modalImage} onOpenChange={() => setModalImage(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalImage && (
            <div className="flex gap-4 items-start">
              <img
                src={modalImage.url}
                alt={modalImage.prompt}
                className="max-h-[80vh] max-w-[70vw] object-contain rounded-md"
              />
              <div className="flex flex-col gap-2 min-w-[120px] pt-8">
                <Button size="sm" variant="outline" onClick={() => handleDownload(modalImage.url, `creative-${modalImage.id}.png`)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { deleteCreative.mutate({ id: modalImage.id, projectId: modalImage.projectId }); setModalImage(null); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalImage.prompt}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === PROMPT + OPTIONS (bottom) === */}
      <div className="px-3 pb-3 pt-2 space-y-2">
        {/* Swipe Elements Editor */}
        {selectedSwipe && (
          <SwipeElementsEditor
            analysis={analysis}
            isPending={isPending}
            overrides={elementOverrides}
            onChange={setElementOverrides}
            hasLogo={hasLogo}
            hasPersonPhotos={hasPersonPhotos}
          />
        )}

        <div className="flex gap-2 items-start">
          {selectedSwipe && (
            <div className="w-12 h-12 rounded-md overflow-hidden border bg-secondary flex-shrink-0">
              <img src={selectedSwipe.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <Textarea
            placeholder="Descreva as modificações que deseja no criativo..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-secondary resize-none min-h-[60px] text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
            }}
          />
        </div>

        {/* Brand Kit options — inline */}
        {brandKit && (hasLogo || hasPersonPhotos) && (
          <div className="flex flex-wrap items-center gap-3">
            {hasLogo && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={includeLogo} onCheckedChange={(v) => setIncludeLogo(!!v)} className="h-3.5 w-3.5" />
                <img src={brandKit.logo_url!} alt="Logo" className="h-5 w-5 object-contain rounded" />
                <span className="text-[10px] text-muted-foreground">Logo</span>
              </label>
            )}
            {hasPersonPhotos && (
              <div className="flex items-center gap-1.5">
                <Checkbox checked={includePersonPhoto} onCheckedChange={(v) => { setIncludePersonPhoto(!!v); if (!v) setSelectedPersonPhoto(''); }} className="h-3.5 w-3.5" />
                <span className="text-[10px] text-muted-foreground">Pessoa:</span>
                {personPhotos.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => { setIncludePersonPhoto(true); setSelectedPersonPhoto(url); }}
                    className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-colors ${selectedPersonPhoto === url && includePersonPhoto ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={url} alt={`Pessoa ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-[80px] bg-secondary h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating || !selectedSwipe || !prompt.trim()} className="flex-1 h-8 text-xs">
            {generating ? (<><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Gerando...</>) : (<><Zap className="h-3.5 w-3.5 mr-1 fill-primary-foreground" /> Gerar Criativo</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
