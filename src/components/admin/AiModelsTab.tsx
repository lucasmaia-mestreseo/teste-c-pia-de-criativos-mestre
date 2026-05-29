import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, Sparkles } from 'lucide-react';

// Curated OpenRouter image-capable models
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

interface ImageGenSettings {
  provider: string;
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
  primary_attempts: number;
  fallback_attempts: number;
  tertiary_attempts: number;
}

const DEFAULTS: ImageGenSettings = {
  provider: 'openrouter',
  primary_model: 'openai/gpt-5.4-image-2',
  fallback_model: 'google/gemini-3.1-flash-image-preview',
  tertiary_model: 'x-ai/grok-imagine-image-quality',
  primary_attempts: 2,
  fallback_attempts: 1,
  tertiary_attempts: 1,
};

export function AiModelsTab() {
  const [settings, setSettings] = useState<ImageGenSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'image_generation')
        .maybeSingle();
      if (!error && data?.value) {
        setSettings({ ...DEFAULTS, ...(data.value as any) });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: settings as any, updated_at: new Date().toISOString() })
      .eq('key', 'image_generation');
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configurações de modelos salvas.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTier = (
    tier: 'primary' | 'fallback' | 'tertiary',
    label: string,
    description: string,
  ) => {
    const modelKey = `${tier}_model` as const;
    const attemptsKey = `${tier}_attempts` as const;
    const currentModel = settings[modelKey];
    const isCustom = !IMAGE_MODELS.some((m) => m.value === currentModel);

    return (
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold">{label}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Modelo</Label>
            <Select
              value={isCustom ? '__custom__' : currentModel}
              onValueChange={(v) => {
                if (v === '__custom__') return;
                setSettings((s) => ({ ...s, [modelKey]: v }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
                {isCustom && (
                  <SelectItem value="__custom__">{currentModel} (custom)</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input
              value={currentModel}
              onChange={(e) => setSettings((s) => ({ ...s, [modelKey]: e.target.value }))}
              placeholder="provider/model-slug"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tentativas</Label>
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
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Modelos de IA</h2>
          <p className="text-sm text-muted-foreground">
            Configure a cascata de modelos para geração de imagens via OpenRouter. O sistema tenta o primário; se falhar, passa para o fallback e depois para o terciário.
          </p>
        </div>
      </div>

      {renderTier('primary', 'Modelo Primário', 'Primeira escolha para todas as gerações de imagem.')}
      {renderTier('fallback', 'Modelo Fallback', 'Acionado quando o primário esgota as tentativas.')}
      {renderTier('tertiary', 'Modelo Terciário', 'Última tentativa antes de retornar erro ao usuário.')}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
