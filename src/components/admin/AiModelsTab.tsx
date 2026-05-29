import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Save, Sparkles, ImagePlus, MessageSquareText, Eye, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Model catalogs (extend as needed; field is also free-text)
const IMAGE_MODELS: { value: string; label: string }[] = [
  { value: 'openai/gpt-5.4-image-2', label: 'OpenAI · GPT-5.4 Image 2' },
  { value: 'openai/gpt-5-image', label: 'OpenAI · GPT-5 Image' },
  { value: 'google/gemini-3.1-flash-image-preview', label: 'Google · Gemini 3.1 Flash Image (Preview)' },
  { value: 'google/gemini-3-pro-image-preview', label: 'Google · Gemini 3 Pro Image (Preview)' },
  { value: 'google/gemini-2.5-flash-image', label: 'Google · Gemini 2.5 Flash Image (Nano Banana)' },
  { value: 'x-ai/grok-imagine-image-quality', label: 'xAI · Grok Imagine (Quality)' },
  { value: 'x-ai/grok-imagine-image', label: 'xAI · Grok Imagine' },
  { value: 'black-forest-labs/flux-1.1-pro', label: 'Black Forest Labs · FLUX 1.1 Pro' },
  { value: 'black-forest-labs/flux-pro', label: 'Black Forest Labs · FLUX Pro' },
];

const TEXT_MODELS: { value: string; label: string }[] = [
  { value: 'google/gemini-3-flash-preview', label: 'Google · Gemini 3 Flash (Preview)' },
  { value: 'google/gemini-3.1-flash-lite-preview', label: 'Google · Gemini 3.1 Flash Lite (Preview)' },
  { value: 'google/gemini-3.5-flash', label: 'Google · Gemini 3.5 Flash' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Google · Gemini 3.1 Pro (Preview)' },
  { value: 'google/gemini-2.5-pro', label: 'Google · Gemini 2.5 Pro' },
  { value: 'google/gemini-2.5-flash', label: 'Google · Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Google · Gemini 2.5 Flash Lite' },
  { value: 'openai/gpt-5', label: 'OpenAI · GPT-5' },
  { value: 'openai/gpt-5-mini', label: 'OpenAI · GPT-5 Mini' },
  { value: 'openai/gpt-5.4', label: 'OpenAI · GPT-5.4' },
  { value: 'openai/gpt-5.4-mini', label: 'OpenAI · GPT-5.4 Mini' },
  { value: 'openai/gpt-5.4-nano', label: 'OpenAI · GPT-5.4 Nano' },
  { value: 'openai/gpt-5.5', label: 'OpenAI · GPT-5.5' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic · Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3.5-haiku', label: 'Anthropic · Claude 3.5 Haiku' },
  { value: 'anthropic/claude-sonnet-4', label: 'Anthropic · Claude Sonnet 4' },
  { value: 'x-ai/grok-2-1212', label: 'xAI · Grok 2 (1212)' },
  { value: 'x-ai/grok-4', label: 'xAI · Grok 4' },
];

interface ModelSettings {
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
}

type SettingsKey = 'image_generation' | 'text_reasoning' | 'vision_analysis';
type TierId = 'primary' | 'fallback' | 'tertiary';
const TIER_ORDER: TierId[] = ['primary', 'fallback', 'tertiary'];
const TIER_LABELS = ['Primário', 'Fallback', 'Terciário'];

const DEFAULTS: Record<SettingsKey, ModelSettings> = {
  image_generation: {
    primary_model: 'openai/gpt-5.4-image-2',
    fallback_model: 'google/gemini-3.1-flash-image-preview',
    tertiary_model: 'x-ai/grok-imagine-image-quality',
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  text_reasoning: {
    primary_model: 'google/gemini-3-flash-preview',
    fallback_model: 'openai/gpt-5.4-mini',
    tertiary_model: 'anthropic/claude-3.5-haiku',
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  vision_analysis: {
    primary_model: 'google/gemini-2.5-flash',
    fallback_model: 'google/gemini-3-flash-preview',
    tertiary_model: 'openai/gpt-5.4-mini',
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
};

interface SectionConfig {
  key: SettingsKey;
  title: string;
  description: string;
  icon: React.ReactNode;
  catalog: { value: string; label: string }[];
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'image_generation',
    title: 'Geração de Imagens',
    description: 'Modelos usados em toda geração visual de criativos.',
    icon: <ImagePlus className="h-4 w-4" />,
    catalog: IMAGE_MODELS,
  },
  {
    key: 'text_reasoning',
    title: 'Texto e Raciocínio',
    description: 'Sugestões, briefings dinâmicos e extrações textuais.',
    icon: <MessageSquareText className="h-4 w-4" />,
    catalog: TEXT_MODELS,
  },
  {
    key: 'vision_analysis',
    title: 'Análise de Imagens (Visão)',
    description: 'Análise de swipe files, screenshots de marca e logos.',
    icon: <Eye className="h-4 w-4" />,
    catalog: TEXT_MODELS,
  },
];

// Convert settings <-> ordered tier list
interface TierItem {
  uid: string; // stable id for dnd
  model: string;
  attempts: number;
}

function settingsToTiers(s: ModelSettings, uids: string[]): TierItem[] {
  return TIER_ORDER.map((t, i) => ({
    uid: uids[i],
    model: s[`${t}_model` as const],
    attempts: s[`${t}_attempts` as const],
  }));
}

function tiersToSettings(tiers: TierItem[]): ModelSettings {
  const out = {} as ModelSettings;
  TIER_ORDER.forEach((t, i) => {
    out[`${t}_model` as const] = tiers[i].model;
    out[`${t}_attempts` as const] = tiers[i].attempts;
  });
  return out;
}

interface SortableTierProps {
  item: TierItem;
  index: number;
  catalog: { value: string; label: string }[];
  onChange: (patch: Partial<TierItem>) => void;
}

function SortableTier({ item, index, catalog, onChange }: SortableTierProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  const isCustom = !catalog.some((m) => m.value === item.model);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex gap-3 rounded-md border bg-background/40 p-3 transition-shadow',
        isDragging && 'shadow-lg border-primary/50',
      )}
    >
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex items-start pt-1"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {TIER_LABELS[index]}
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-2">
          <div className="space-y-1.5">
            <Select
              value={isCustom ? '__custom__' : item.model}
              onValueChange={(v) => {
                if (v === '__custom__') return;
                onChange({ model: v });
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
                {isCustom && <SelectItem value="__custom__">{item.model} (custom)</SelectItem>}
              </SelectContent>
            </Select>
            <Input
              value={item.model}
              onChange={(e) => onChange({ model: e.target.value })}
              placeholder="provider/model-slug"
              className="text-xs font-mono h-8"
            />
          </div>
          <div>
            <Input
              type="number"
              min={0}
              max={10}
              value={item.attempts}
              onChange={(e) =>
                onChange({ attempts: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)) })
              }
              className="text-xs"
              title="Tentativas"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">tentativas</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ config }: { config: SectionConfig }) {
  // Stable UIDs per slot — survive reorder so dnd-kit keeps identity
  const [uids] = useState<string[]>(() => [
    `${config.key}-a`,
    `${config.key}-b`,
    `${config.key}-c`,
  ]);
  const [tiers, setTiers] = useState<TierItem[]>(() => settingsToTiers(DEFAULTS[config.key], uids));
  const [initialSettings, setInitialSettings] = useState<ModelSettings>(DEFAULTS[config.key]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const settings = tiersToSettings(tiers);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', config.key)
        .maybeSingle();
      const merged: ModelSettings = data?.value
        ? { ...DEFAULTS[config.key], ...(data.value as any) }
        : DEFAULTS[config.key];
      setTiers(settingsToTiers(merged, uids));
      setInitialSettings(merged);
      setLoading(false);
    })();
  }, [config.key, uids]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: config.key, value: settings as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      setInitialSettings(settings);
      toast.success(`${config.title} salvo.`);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tiers.findIndex((t) => t.uid === active.id);
    const newIdx = tiers.findIndex((t) => t.uid === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setTiers((prev) => arrayMove(prev, oldIdx, newIdx));
  };

  const updateTier = (uid: string, patch: Partial<TierItem>) => {
    setTiers((prev) => prev.map((t) => (t.uid === uid ? { ...t, ...patch } : t)));
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-5 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando {config.title}…</span>
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-card overflow-hidden transition-colors hover:border-primary/40"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-4 p-4 text-left hover:bg-secondary/50 transition-colors"
        >
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">{config.icon}</div>

          <div className="min-w-0 shrink-0 w-56">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate">{config.title}</h3>
              {isDirty && (
                <span className="text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  não salvo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{config.description}</p>
          </div>

          <div className="flex-1 min-w-0 hidden md:flex items-center gap-2 text-[11px] font-mono text-muted-foreground overflow-hidden">
            <span className="truncate">
              <span className="text-foreground/70">P:</span> {settings.primary_model}{' '}
              <span className="opacity-60">({settings.primary_attempts}x)</span>
            </span>
            <span className="opacity-40">→</span>
            <span className="truncate">
              <span className="text-foreground/70">F:</span> {settings.fallback_model}{' '}
              <span className="opacity-60">({settings.fallback_attempts}x)</span>
            </span>
            <span className="opacity-40">→</span>
            <span className="truncate">
              <span className="text-foreground/70">T:</span> {settings.tertiary_model}{' '}
              <span className="opacity-60">({settings.tertiary_attempts}x)</span>
            </span>
          </div>

          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-5 pb-5 pt-4 space-y-4 border-t">
          <p className="text-[11px] text-muted-foreground">
            Arraste pelo <GripVertical className="inline h-3 w-3 -mt-0.5" /> para reordenar a cascata.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={tiers.map((t) => t.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <SortableTier
                    key={t.uid}
                    item={t}
                    index={i}
                    catalog={config.catalog}
                    onChange={(patch) => updateTier(t.uid, patch)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !isDirty} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AiModelsTab() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Modelos de IA</h2>
          <p className="text-sm text-muted-foreground">
            Configure a cascata de modelos via OpenRouter para cada categoria. O sistema tenta o primário e, em caso de falha, recorre ao fallback e depois ao terciário.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <SectionCard key={s.key} config={s} />
        ))}
      </div>
    </div>
  );
}
