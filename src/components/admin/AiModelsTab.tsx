import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Save, Sparkles, ImagePlus, MessageSquareText, Eye, ChevronDown, GripVertical, ListChecks, BookOpenCheck, Layers } from 'lucide-react';
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
import { ModelCatalogDialog } from './ModelCatalogDialog';

interface ModelSettings {
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
}

type SettingsKey = 'image_generation' | 'image_unfold' | 'text_reasoning' | 'vision_analysis' | 'brand_manual';
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
  image_unfold: {
    primary_model: 'google/gemini-3.1-flash-image-preview',
    fallback_model: 'openai/gpt-5.4-image-2',
    tertiary_model: 'google/gemini-3.1-flash-image-preview',
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 0,
  },
  text_reasoning: {
    primary_model: 'google/gemini-3-flash-preview',
    fallback_model: 'openai/gpt-5.4-mini',
    tertiary_model: 'anthropic/claude-3.5-haiku',
    primary_attempts: 2,
    fallback_attempts: 1,
    tertiary_attempts: 1,
  },
  brand_manual: {
    primary_model: 'anthropic/claude-sonnet-4.5',
    fallback_model: 'google/gemini-3-flash-preview',
    tertiary_model: 'openai/gpt-5.4-mini',
    primary_attempts: 1,
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
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'image_generation',
    title: 'Geração de Imagens',
    description: 'Modelos usados em toda geração visual de criativos.',
    icon: <ImagePlus className="h-4 w-4" />,
  },
  {
    key: 'image_unfold',
    title: 'Desdobramento e Redimensionar',
    description: 'Adaptação de uma peça pronta para outros formatos. Padrão: Nano Banana 2 (Gemini 3.1 Flash Image).',
    icon: <Layers className="h-4 w-4" />,
  },
  {
    key: 'text_reasoning',
    title: 'Texto e Raciocínio',
    description: 'Sugestões, briefings dinâmicos e extrações textuais.',
    icon: <MessageSquareText className="h-4 w-4" />,
  },
  {
    key: 'vision_analysis',
    title: 'Análise de Imagens (Visão)',
    description: 'Análise de swipe files, screenshots de marca e logos.',
    icon: <Eye className="h-4 w-4" />,
  },
  {
    key: 'brand_manual',
    title: 'Manuais de marca (Criação de KVs)',
    description: 'Estratégia do manual a partir do briefing: estrutura, páginas sob medida e orientações. Recomendado: Claude.',
    icon: <BookOpenCheck className="h-4 w-4" />,
  },
];

interface TierItem {
  uid: string;
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
  const inCatalog = catalog.some((m) => m.value === item.model);

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
              value={inCatalog ? item.model : '__custom__'}
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
                {!inCatalog && (
                  <SelectItem value="__custom__">
                    {item.model} (fora do catálogo)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input
              value={item.model}
              onChange={(e) => onChange({ model: e.target.value })}
              placeholder="provider/model-slug"
              className={cn('text-xs font-mono h-8', !inCatalog && 'border-amber-500/50')}
            />
            {!inCatalog && (
              <p className="text-[10px] text-amber-600">
                Este modelo não está no catálogo habilitado. Habilite-o em "Catálogo de Modelos" ou troque acima.
              </p>
            )}
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

interface SectionCardProps {
  config: SectionConfig;
  catalog: { value: string; label: string }[];
}

function SectionCard({ config, catalog }: SectionCardProps) {
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
            {catalog.length === 0 && (
              <span className="ml-2 text-amber-600">
                Nenhum modelo habilitado no catálogo desta categoria.
              </span>
            )}
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={tiers.map((t) => t.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <SortableTier
                    key={t.uid}
                    item={t}
                    index={i}
                    catalog={catalog}
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

interface ModelCatalogs {
  image_generation: string[];
  text_reasoning: string[];
  vision_analysis: string[];
}

function slugToLabel(slug: string): string {
  const [provider, ...rest] = slug.split('/');
  const model = rest.join('/');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const providerLabel = cap(provider ?? slug);
  const modelLabel = (model || slug)
    .split('-')
    .map((p) => (p.length <= 3 ? p.toUpperCase() : cap(p)))
    .join(' ');
  return `${providerLabel} · ${modelLabel}`;
}

export function AiModelsTab() {
  const [catalogs, setCatalogs] = useState<ModelCatalogs>({
    image_generation: [],
    text_reasoning: [],
    vision_analysis: [],
  });
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const loadCatalogs = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'model_catalogs')
      .maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setCatalogs({
        image_generation: v.image_generation ?? [],
        text_reasoning: v.text_reasoning ?? [],
        vision_analysis: v.vision_analysis ?? [],
      });
    }
    setCatalogsLoading(false);
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const buildCatalog = (key: SettingsKey) =>
    catalogs[key === 'brand_manual' ? 'text_reasoning' : key === 'image_unfold' ? 'image_generation' : key].map((slug) => ({ value: slug, label: slugToLabel(slug) }));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary mt-1" />
        <div className="flex-1">
          <h2 className="text-xl font-bold">Modelos de IA</h2>
          <p className="text-sm text-muted-foreground">
            Configure a cascata de modelos via OpenRouter para cada categoria. O sistema tenta o primário e, em caso de falha, recorre ao fallback e depois ao terciário.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
          <ListChecks className="h-3.5 w-3.5 mr-2" />
          Catálogo de Modelos
        </Button>
      </div>

      {catalogsLoading ? (
        <div className="rounded-lg border bg-card p-5 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregando catálogo…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <SectionCard key={s.key} config={s} catalog={buildCatalog(s.key)} />
          ))}
        </div>
      )}

      <ModelCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSaved={loadCatalogs}
      />
    </div>
  );
}
