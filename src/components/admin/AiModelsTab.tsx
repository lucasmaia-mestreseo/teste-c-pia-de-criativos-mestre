import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Save, Sparkles, ImagePlus, MessageSquareText, Eye, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function SectionCard({ config }: { config: SectionConfig }) {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULTS[config.key]);
  const [initial, setInitial] = useState<ModelSettings>(DEFAULTS[config.key]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', config.key)
        .maybeSingle();
      const merged = data?.value
        ? { ...DEFAULTS[config.key], ...(data.value as any) }
        : DEFAULTS[config.key];
      setSettings(merged);
      setInitial(merged);
      setLoading(false);
    })();
  }, [config.key]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);

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
      setInitial(settings);
      toast.success(`${config.title} salvo.`);
    }
  };

  const renderTier = (tier: 'primary' | 'fallback' | 'tertiary', label: string) => {
    const modelKey = `${tier}_model` as const;
    const attemptsKey = `${tier}_attempts` as const;
    const currentModel = settings[modelKey];
    const isCustom = !config.catalog.some((m) => m.value === currentModel);

    return (
      <div className="space-y-2 border-l-2 border-primary/20 pl-4">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-2">
          <div className="space-y-1.5">
            <Select
              value={isCustom ? '__custom__' : currentModel}
              onValueChange={(v) => {
                if (v === '__custom__') return;
                setSettings((s) => ({ ...s, [modelKey]: v }));
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.catalog.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
                {isCustom && <SelectItem value="__custom__">{currentModel} (custom)</SelectItem>}
              </SelectContent>
            </Select>
            <Input
              value={currentModel}
              onChange={(e) => setSettings((s) => ({ ...s, [modelKey]: e.target.value }))}
              placeholder="provider/model-slug"
              className="text-xs font-mono h-8"
            />
          </div>
          <div>
            <Input
              type="number"
              min={0}
              max={10}
              value={settings[attemptsKey]}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  [attemptsKey]: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                }))
              }
              className="text-xs"
              title="Tentativas"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">tentativas</p>
          </div>
        </div>
      </div>
    );
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
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card overflow-hidden transition-colors hover:border-primary/40">
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
        <div className="px-5 pb-5 pt-1 space-y-4 border-t">
          <div className="space-y-4 pt-4">
            {renderTier('primary', 'Primário')}
            {renderTier('fallback', 'Fallback')}
            {renderTier('tertiary', 'Terciário')}
          </div>

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
