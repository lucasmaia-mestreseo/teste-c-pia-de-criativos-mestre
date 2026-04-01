import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { useCreativeFormats } from '@/hooks/useCreativeFormats';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useSwipeAnalysis } from '@/hooks/useSwipeAnalysis';
import SwipeElementsEditor, { type ElementOverrides } from '@/components/SwipeElementsEditor';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Zap, Download, Trash2, Loader2, Maximize2, Minimize2, Star, Eye } from 'lucide-react';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import type { CreationMode } from '@/components/CreationModeSelector';
import type { FreePromptData } from '@/components/FreePromptPanel';
import type { TemplateData } from '@/components/TemplatesPanel';

const EMPTY_OVERRIDES: ElementOverrides = { texts: {}, logos: {}, photos: {} };
const STORAGE_KEY = 'thumbSize-generate';

interface GeneratePanelProps {
  projectId: string | null;
  selectedSwipe: Tables<'swipe_files'> | null;
  creationMode: CreationMode;
  freePromptData: FreePromptData;
  templateData: TemplateData;
}

export default function GeneratePanel({ projectId, selectedSwipe, creationMode, freePromptData, templateData }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<string>('1:1');
  const [generating, setGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [includePersonPhoto, setIncludePersonPhoto] = useState(false);
  const [selectedPersonPhoto, setSelectedPersonPhoto] = useState<string>('');
  const [personMode, setPersonMode] = useState<'photo' | 'grid'>('photo');
  const [ignoreBrandKit, setIgnoreBrandKit] = useState(false);
  const [ignoreContext, setIgnoreContext] = useState(false);
  const [thumbSize, setThumbSize] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 160);
  const [modalImage, setModalImage] = useState<{ url: string; prompt: string; id: string; projectId: string; favorite: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);
  const [elementOverrides, setElementOverrides] = useState<ElementOverrides>(EMPTY_OVERRIDES);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const { data: brandKit } = useBrandKit(projectId);
  const { data: formats } = useCreativeFormats();
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();
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

  useEffect(() => {
    setElementOverrides(EMPTY_OVERRIDES);
  }, [selectedSwipe?.id]);

  const hasLogo = !!brandKit?.logo_url;
  const personPhotos = brandKit?.people_photos?.filter(Boolean) ?? [];
  const hasPersonPhotos = personPhotos.length > 0;
  const hasGrid = !!(brandKit as any)?.person_grid_url;

  const formatLabels = (formats || []).map((f: any) => f.label as string);
  const FORMATS = formatLabels.length > 0 ? formatLabels : ['9:16', '4:5', '1:1', '16:9'];

  const handleThumbSizeChange = ([v]: number[]) => {
    setThumbSize(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  };

  const getEffectivePrompt = (): string => {
    if (creationMode === 'free') return freePromptData.prompt;
    if (creationMode === 'templates') return templateData.prompt || '';
    return prompt;
  };

  const canGenerate = (): boolean => {
    if (!projectId) return false;
    if (creationMode === 'free') return freePromptData.prompt.trim().length > 0;
    if (creationMode === 'templates') return !!templateData.templateId;
    return !!selectedSwipe && prompt.trim().length > 0;
  };

  const handleGenerate = async () => {
    if (!projectId || !canGenerate()) {
      toast.error('Preencha os campos necessários para gerar');
      return;
    }
    setGenerating(true);
    try {
      const anyLogoReplace = Object.values(elementOverrides.logos).some(l => l.action === 'replace');
      const anyPhotoReplace = Object.values(elementOverrides.photos).some(p => p.action === 'replace');

      const logoUrl = (includeLogo || anyLogoReplace) && hasLogo ? brandKit?.logo_url : null;

      const useGrid = personMode === 'grid' && hasGrid;
      const personPhotoUrl = useGrid
        ? null
        : ((includePersonPhoto && selectedPersonPhoto)
          ? selectedPersonPhoto
          : (anyPhotoReplace && personPhotos.length > 0 ? (selectedPersonPhoto || personPhotos[0]) : null));
      const personGridUrl = useGrid && (includePersonPhoto || anyPhotoReplace)
        ? (brandKit as any).person_grid_url
        : null;

      const body: Record<string, any> = {
        format,
        projectId,
        mode: creationMode,
        brandKit: brandKit ? {
          primaryColor: brandKit.primary_color,
          secondaryColor: brandKit.secondary_color,
          backgroundColor: brandKit.background_color,
          auxColors: brandKit.aux_colors,
          typography: brandKit.typography,
          logoUrl,
          personPhotoUrl,
          personGridUrl,
        } : null,
      };

      if (creationMode === 'swipe') {
        body.prompt = prompt.trim();
        body.swipeFileId = selectedSwipe!.id;
        body.swipeFileUrl = selectedSwipe!.image_url;
        body.elementOverrides = analysis ? elementOverrides : null;
      } else if (creationMode === 'free') {
        body.prompt = freePromptData.prompt.trim();
        body.attachedImages = freePromptData.attachedImages;
      } else if (creationMode === 'templates') {
        body.prompt = templateData.prompt?.trim() || '';
        body.templateId = templateData.templateId;
        body.templateFields = templateData.fields;
        body.attachedImages = templateData.attachedImages;
      }

      const { data, error } = await supabase.functions.invoke('generate-creative', { body });
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
      const buf = await res.arrayBuffer();
      const clean = stripPngMetadata(new Uint8Array(buf));
      const blob = new Blob([clean.buffer as ArrayBuffer], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Erro no download');
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteCreative.mutate(deleteTarget);
      if (modalImage?.id === deleteTarget.id) setModalImage(null);
      setDeleteTarget(null);
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
                  onValueChange={handleThumbSizeChange}
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
                className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0"
                style={{ width: thumbSize, height: thumbSize }}
              >
                <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
                {/* Bottom action bar on hover */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 py-1">
                  <button onClick={() => setModalImage({ url: c.image_url, prompt: c.prompt, id: c.id, projectId: c.project_id, favorite: (c as any).favorite })} className="p-1 rounded-full hover:bg-accent transition-colors" title="Detalhes">
                    <Eye className="h-3 w-3 text-foreground" />
                  </button>
                  <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !(c as any).favorite })} className="p-1 rounded-full hover:bg-accent transition-colors" title="Favoritar">
                    <Star className={`h-3 w-3 ${(c as any).favorite ? 'fill-yellow-400 text-yellow-400' : 'text-foreground'}`} />
                  </button>
                  <button onClick={() => handleDownload(c.image_url, `creative-${c.id}.png`)} className="p-1 rounded-full hover:bg-accent transition-colors" title="Download">
                    <Download className="h-3 w-3 text-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget({ id: c.id, projectId: c.project_id })} className="p-1 rounded-full hover:bg-accent transition-colors" title="Excluir">
                    <Trash2 className="h-3 w-3 text-destructive" />
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
                <Button
                  size="sm"
                  variant={modalImage.favorite ? 'default' : 'outline'}
                  onClick={() => {
                    toggleFavorite.mutate({ id: modalImage.id, projectId: modalImage.projectId, favorite: !modalImage.favorite });
                    setModalImage({ ...modalImage, favorite: !modalImage.favorite });
                  }}
                >
                  <Star className={`h-3.5 w-3.5 mr-1 ${modalImage.favorite ? 'fill-primary-foreground' : ''}`} />
                  {modalImage.favorite ? 'Favoritado' : 'Favoritar'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalImage.id, projectId: modalImage.projectId })}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalImage.prompt}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir criativo</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este criativo? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* === PROMPT + OPTIONS (bottom) === */}
      <div className="px-3 pb-3 pt-2 space-y-2">
        {/* Swipe Elements Editor — only in swipe mode */}
        {creationMode === 'swipe' && selectedSwipe && (
          <SwipeElementsEditor
            analysis={analysis}
            isPending={isPending}
            overrides={elementOverrides}
            onChange={setElementOverrides}
            hasLogo={hasLogo}
            hasPersonPhotos={hasPersonPhotos}
            projectContext={projectContext}
          />
        )}

        {/* Prompt area — only in swipe mode (free/templates have their own) */}
        {creationMode === 'swipe' && (
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
        )}

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
                {hasGrid && (
                  <RadioGroup
                    value={personMode}
                    onValueChange={(v) => setPersonMode(v as 'photo' | 'grid')}
                    className="flex items-center gap-2 ml-2"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="photo" id="mode-photo" className="h-3 w-3" />
                      <Label htmlFor="mode-photo" className="text-[10px] text-muted-foreground cursor-pointer">Foto</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="grid" id="mode-grid" className="h-3 w-3" />
                      <Label htmlFor="mode-grid" className="text-[10px] text-muted-foreground cursor-pointer">Grid</Label>
                    </div>
                  </RadioGroup>
                )}
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
          <Button onClick={handleGenerate} disabled={generating || !canGenerate()} className="flex-1 h-8 text-xs">
            {generating ? (<><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Gerando...</>) : (<><Zap className="h-3.5 w-3.5 mr-1 fill-primary-foreground" /> Gerar Criativo</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
