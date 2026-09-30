import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Loader2, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CreationModeSelector, { type CreationMode } from '@/components/CreationModeSelector';
import FreePromptPanel, { type FreePromptData } from '@/components/FreePromptPanel';
import TemplatesPanel, { type TemplateData } from '@/components/TemplatesPanel';
import SwipeFilePanel from '@/components/SwipeFilePanel';
import SwipeElementsEditor, { type ElementOverrides } from '@/components/SwipeElementsEditor';
import PositionGrid, { type Position } from '@/components/PositionGrid';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useCreativeFormats } from '@/hooks/useCreativeFormats';
import { useSwipeAnalysis } from '@/hooks/useSwipeAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import { reviewCreative } from '@/lib/creativeOps';
import { Textarea } from '@/components/ui/textarea';
import type { Tables } from '@/integrations/supabase/types';
import ActiveGuideBadge from '@/components/kv/ActiveGuideBadge';
import { getCurrentTaskId } from '@/hooks/useTasks';
import TaskNotice from '@/components/TaskNotice';

const EMPTY_OVERRIDES: ElementOverrides = { texts: {}, logos: {}, photos: {} };

type LogoSize = 'small' | 'normal' | 'large';

interface GenerationControlsProps {
  projectId: string;
  creationMode: CreationMode;
  onCreationModeChange: (mode: CreationMode) => void;
  selectedSwipe: Tables<'swipe_files'> | null;
  onSelectSwipe: (s: Tables<'swipe_files'> | null) => void;
  freePromptData: FreePromptData;
  onFreePromptDataChange: (d: FreePromptData) => void;
  templateData: TemplateData;
  onTemplateDataChange: (d: TemplateData) => void;
  onGeneratingChange: (g: boolean) => void;
}

function TogglePill({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      {children}
    </button>
  );
}

export default function GenerationControls({
  projectId,
  creationMode,
  onCreationModeChange,
  selectedSwipe,
  onSelectSwipe,
  freePromptData,
  onFreePromptDataChange,
  templateData,
  onTemplateDataChange,
  onGeneratingChange,
}: GenerationControlsProps) {
  const [format, setFormat] = useState('9:16');
  const [generating, setGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoPosition, setLogoPosition] = useState<Position | null>(null);
  const [logoSize, setLogoSize] = useState<LogoSize | null>(null);
  const [includePersonPhoto, setIncludePersonPhoto] = useState(false);
  const [selectedPersonPhoto, setSelectedPersonPhoto] = useState('');
  const [personMode, setPersonMode] = useState<'photo' | 'grid'>('photo');
  const [personPosition, setPersonPosition] = useState<Position | null>(null);
  const [useBrandKitFlag, setUseBrandKitFlag] = useState(true);
  const [useContext, setUseContext] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [swipePrompt, setSwipePrompt] = useState('');
  const [elementOverrides, setElementOverrides] = useState<ElementOverrides>(EMPTY_OVERRIDES);

  const { data: brandKit } = useBrandKit(projectId);
  const { data: formats } = useCreativeFormats();
  const { analysis, isPending } = useSwipeAnalysis(selectedSwipe as any);
  const qc = useQueryClient();

  const { data: projectData } = useQuery({
    queryKey: ['project-context', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('context').eq('id', projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
  const projectContext = projectData?.context ?? '';

  useEffect(() => { setElementOverrides(EMPTY_OVERRIDES); }, [selectedSwipe?.id]);

  const hasLogo = !!brandKit?.logo_url;
  const personPhotos = brandKit?.people_photos?.filter(Boolean) ?? [];
  const hasPersonPhotos = personPhotos.length > 0;
  const hasGrid = !!(brandKit as any)?.person_grid_url;

  const formatLabels = (formats || []).map((f: any) => f.label as string);
  const FORMATS = formatLabels.length > 0 ? formatLabels : ['9:16', '4:5', '1:1', '16:9'];

  const getEffectivePrompt = (): string => {
    if (creationMode === 'free') return freePromptData.prompt;
    if (creationMode === 'templates') return templateData.prompt || '';
    return swipePrompt;
  };

  const canGenerate = (): boolean => {
    if (!projectId) return false;
    if (creationMode === 'free') return freePromptData.prompt.trim().length > 0;
    if (creationMode === 'templates') return !!templateData.templateId;
    return !!selectedSwipe && swipePrompt.trim().length > 0;
  };

  const handleGenerate = async () => {
    if (!projectId || !canGenerate()) {
      toast.error('Preencha os campos necessários para gerar');
      return;
    }
    setGenerating(true);
    onGeneratingChange(true);
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

      const ignoreBrandKit = !useBrandKitFlag;
      const ignoreContext = !useContext;

      const body: Record<string, any> = {
        format,
        projectId,
        mode: creationMode,
        ignoreBrandKit,
        brandKit: ignoreBrandKit ? null : (brandKit ? {
          primaryColor: brandKit.primary_color,
          secondaryColor: brandKit.secondary_color,
          backgroundColor: brandKit.background_color,
          auxColors: brandKit.aux_colors,
          typography: brandKit.typography,
          logoUrl,
          personPhotoUrl,
          personGridUrl,
        } : null),
        ignoreContext,
        logoPosition: includeLogo ? logoPosition : null,
        logoSize: includeLogo ? logoSize : null,
        personPosition: includePersonPhoto ? personPosition : null,
      };

      if (creationMode === 'swipe') {
        body.prompt = swipePrompt.trim();
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

      body.taskId = getCurrentTaskId(projectId) ?? undefined; // the piece becomes the next banner of the task
      const result = await invokeWithRetry<{ creativeId?: string }>('generate-creative', body, {
        friendlyName: 'Geração de Criativo',
        projectId,
        maxRetries: 2,
      });
      toast.success('Criativo gerado com sucesso!');
      qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
      // Automatic review runs in the background; its badge shows up on the creative.
      if (result?.creativeId) void reviewCreative(qc, projectId, result.creativeId);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar criativo');
    } finally {
      setGenerating(false);
      onGeneratingChange(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-2.5 space-y-2"><ActiveGuideBadge projectId={projectId} /><TaskNotice projectId={projectId} /></div>
      {/* Mode tabs */}
      <CreationModeSelector mode={creationMode} onChange={onCreationModeChange} />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Mode-specific content (keyed: each mode fades in) */}
        <div key={creationMode} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {creationMode === 'swipe' && (
          <>
            <SwipeFilePanel
              projectId={projectId}
              selectedSwipe={selectedSwipe}
              onSelectSwipe={onSelectSwipe}
            />
            {selectedSwipe && (
              <div className="px-4 py-3 space-y-2 border-t">
                <SwipeElementsEditor
                  analysis={analysis}
                  isPending={isPending}
                  overrides={elementOverrides}
                  onChange={setElementOverrides}
                  hasLogo={hasLogo}
                  hasPersonPhotos={hasPersonPhotos}
                  projectContext={projectContext}
                />
                <div className="flex gap-2 items-start">
                  <div className="w-10 h-10 rounded-md overflow-hidden border bg-secondary flex-shrink-0">
                    <img src={selectedSwipe.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <Textarea
                    placeholder="Descreva as modificações..."
                    value={swipePrompt}
                    onChange={(e) => setSwipePrompt(e.target.value)}
                    className="bg-secondary resize-none min-h-[60px] text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {creationMode === 'free' && (
          <FreePromptPanel
            projectId={projectId}
            data={freePromptData}
            onChange={onFreePromptDataChange}
          />
        )}
        {creationMode === 'templates' && (
          <TemplatesPanel
            projectId={projectId}
            data={templateData}
            onChange={onTemplateDataChange}
          />
        )}
        </div>

        {/* Advanced Settings — tight spacing, no gap */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
            Configurações Avançadas
            <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform duration-300', advancedOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-3 space-y-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-300">
            {/* Logo toggle */}
            {hasLogo && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TogglePill active={includeLogo} onClick={() => setIncludeLogo(!includeLogo)}>
                    Incluir Logo
                  </TogglePill>
                  {includeLogo && brandKit?.logo_url && (
                    <img src={brandKit.logo_url} alt="Logo" className="h-10 w-10 object-contain rounded" />
                  )}
                </div>
                {includeLogo && (
                  <div className="flex items-start gap-6 pl-1">
                    <PositionGrid value={logoPosition} onChange={setLogoPosition} label="Posição" />
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground">Tamanho</span>
                      <div className="flex gap-1.5">
                        {(['small', 'normal', 'large'] as LogoSize[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setLogoSize(logoSize === s ? null : s)}
                            className={cn(
                              'px-3 py-1.5 text-xs rounded border transition-colors',
                              logoSize === s
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary border-border text-muted-foreground hover:border-primary/50'
                            )}
                          >
                            {s === 'small' ? 'P' : s === 'normal' ? 'N' : 'G'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Person toggle */}
            {hasPersonPhotos && (
              <div className="space-y-3">
                <TogglePill active={includePersonPhoto} onClick={() => { setIncludePersonPhoto(!includePersonPhoto); if (includePersonPhoto) setSelectedPersonPhoto(''); }}>
                  Incluir Pessoa
                </TogglePill>

                {includePersonPhoto && (
                  <>
                    {/* Photo thumbnails */}
                    <div className="flex flex-wrap gap-2">
                      {personPhotos.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedPersonPhoto(url)}
                          className={cn(
                            'w-10 h-10 rounded-md overflow-hidden border-2 transition-colors',
                            selectedPersonPhoto === url ? 'border-primary' : 'border-transparent hover:border-primary/50'
                          )}
                        >
                          <img src={url} alt={`Pessoa ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>

                    {/* Photo/Grid mode */}
                    {hasGrid && (
                      <RadioGroup
                        value={personMode}
                        onValueChange={(v) => setPersonMode(v as 'photo' | 'grid')}
                        className="flex items-center gap-3"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="photo" id="ctrl-mode-photo" className="h-3.5 w-3.5" />
                          <Label htmlFor="ctrl-mode-photo" className="text-xs text-muted-foreground cursor-pointer">Foto</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="grid" id="ctrl-mode-grid" className="h-3.5 w-3.5" />
                          <Label htmlFor="ctrl-mode-grid" className="text-xs text-muted-foreground cursor-pointer">Grid</Label>
                        </div>
                      </RadioGroup>
                    )}

                    {/* Position grid */}
                    <PositionGrid value={personPosition} onChange={setPersonPosition} label="Posição da pessoa" />
                  </>
                )}
              </div>
            )}

            {/* Brand Kit & Context toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <TogglePill active={useBrandKitFlag} onClick={() => setUseBrandKitFlag(!useBrandKitFlag)}>
                Brand Kit
              </TogglePill>
              <TogglePill active={useContext} onClick={() => setUseContext(!useContext)}>
                Contexto
              </TogglePill>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Sticky footer: format dropdown + generate button */}
      <div className="px-4 py-3 border-t bg-card flex items-center gap-2">
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[90px] h-9 text-xs bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleGenerate} disabled={generating || !canGenerate()} className={cn('flex-1 h-9 text-sm btn-shine', generating && 'animate-pulse')}>
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Gerando...</>
          ) : (
            <><Zap className="h-4 w-4 mr-1.5 fill-primary-foreground" /> Gerar Criativo</>
          )}
        </Button>
      </div>
    </div>
  );
}
