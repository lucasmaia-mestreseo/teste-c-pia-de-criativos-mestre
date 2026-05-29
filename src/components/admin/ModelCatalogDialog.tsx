import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Save, Search, ImagePlus, MessageSquareText, Eye } from 'lucide-react';

type CategoryKey = 'image_generation' | 'text_reasoning' | 'vision_analysis';

interface CategorizedModel {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt: number | null; completion: number | null };
  input_modalities: string[];
  output_modalities: string[];
}

interface OpenRouterCatalog {
  image_generation: CategorizedModel[];
  text_reasoning: CategorizedModel[];
  vision_analysis: CategorizedModel[];
  synced_at: string;
}

interface ModelCatalogs {
  image_generation: string[];
  text_reasoning: string[];
  vision_analysis: string[];
  synced_at?: string | null;
}

interface ModelSettings {
  primary_model: string;
  fallback_model: string;
  tertiary_model: string;
}

const CATEGORY_META: Record<CategoryKey, { label: string; icon: React.ReactNode }> = {
  image_generation: { label: 'Imagens', icon: <ImagePlus className="h-3.5 w-3.5" /> },
  text_reasoning: { label: 'Texto', icon: <MessageSquareText className="h-3.5 w-3.5" /> },
  vision_analysis: { label: 'Visão', icon: <Eye className="h-3.5 w-3.5" /> },
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  image_generation: 'Geração de Imagens',
  text_reasoning: 'Texto e Raciocínio',
  vision_analysis: 'Análise de Imagens',
};

const TIER_LABELS: Record<string, string> = {
  primary_model: 'Primário',
  fallback_model: 'Fallback',
  tertiary_model: 'Terciário',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ModelCatalogDialog({ open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<OpenRouterCatalog | null>(null);
  const [enabled, setEnabled] = useState<ModelCatalogs>({
    image_generation: [],
    text_reasoning: [],
    vision_analysis: [],
  });
  const [initialEnabled, setInitialEnabled] = useState<ModelCatalogs>({
    image_generation: [],
    text_reasoning: [],
    vision_analysis: [],
  });
  const [tierConfigs, setTierConfigs] = useState<Record<CategoryKey, ModelSettings | null>>({
    image_generation: null,
    text_reasoning: null,
    vision_analysis: null,
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryKey>('image_generation');
  const [blockedModel, setBlockedModel] = useState<{
    modelId: string;
    usages: { category: CategoryKey; tier: string }[];
  } | null>(null);

  // Load saved catalog + tier configs when opening
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['model_catalogs', 'image_generation', 'text_reasoning', 'vision_analysis']);

      const next: ModelCatalogs = {
        image_generation: [],
        text_reasoning: [],
        vision_analysis: [],
      };
      const tiers: Record<CategoryKey, ModelSettings | null> = {
        image_generation: null,
        text_reasoning: null,
        vision_analysis: null,
      };
      for (const row of data ?? []) {
        if (row.key === 'model_catalogs') {
          const v = row.value as any;
          next.image_generation = v?.image_generation ?? [];
          next.text_reasoning = v?.text_reasoning ?? [];
          next.vision_analysis = v?.vision_analysis ?? [];
          next.synced_at = v?.synced_at ?? null;
        } else {
          tiers[row.key as CategoryKey] = row.value as ModelSettings;
        }
      }
      setEnabled(next);
      setInitialEnabled(JSON.parse(JSON.stringify(next)));
      setTierConfigs(tiers);

      // Try to load OpenRouter catalog (cached client-side per session)
      await fetchCatalog(false);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchCatalog = async (showToast = true) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('list-openrouter-models');
    setLoading(false);
    if (error || !data || data.error) {
      if (showToast) toast.error('Falha ao buscar OpenRouter: ' + (error?.message ?? data?.error ?? 'erro'));
      return;
    }
    setCatalog(data as OpenRouterCatalog);
    if (showToast) toast.success('Catálogo atualizado.');
  };

  const isDirty = JSON.stringify(enabled) !== JSON.stringify(initialEnabled);

  const findUsages = (modelId: string): { category: CategoryKey; tier: string }[] => {
    const usages: { category: CategoryKey; tier: string }[] = [];
    (Object.keys(tierConfigs) as CategoryKey[]).forEach((cat) => {
      const cfg = tierConfigs[cat];
      if (!cfg) return;
      (['primary_model', 'fallback_model', 'tertiary_model'] as const).forEach((tier) => {
        if (cfg[tier] === modelId) usages.push({ category: cat, tier });
      });
    });
    return usages;
  };

  const toggleModel = (category: CategoryKey, modelId: string, checked: boolean) => {
    if (!checked) {
      const usages = findUsages(modelId);
      // Only block if removing from a category where it's actually in use
      const relevant = usages.filter((u) => u.category === category);
      if (relevant.length > 0) {
        setBlockedModel({ modelId, usages: relevant });
        return;
      }
    }
    setEnabled((prev) => {
      const set = new Set(prev[category]);
      if (checked) set.add(modelId);
      else set.delete(modelId);
      return { ...prev, [category]: Array.from(set) };
    });
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      image_generation: enabled.image_generation,
      text_reasoning: enabled.text_reasoning,
      vision_analysis: enabled.vision_analysis,
      synced_at: catalog?.synced_at ?? enabled.synced_at ?? null,
    };
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'model_catalogs', value: payload as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      setInitialEnabled(JSON.parse(JSON.stringify(payload)));
      toast.success('Catálogo salvo.');
      onSaved();
    }
  };

  const renderList = (cat: CategoryKey) => {
    const list = catalog?.[cat] ?? [];
    const enabledSet = new Set(enabled[cat]);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
        )
      : list;

    // Show enabled-but-missing-from-catalog models too
    const inCatalogIds = new Set(list.map((m) => m.id));
    const orphans = enabled[cat].filter((id) => !inCatalogIds.has(id));

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enabled[cat].length} de {list.length} habilitados
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() =>
              setEnabled((p) => ({ ...p, [cat]: filtered.map((m) => m.id) }))
            }
          >
            Selecionar todos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              // Clear all except in-use ones
              const protectedIds = findUsagesAll().filter((u) => u.category === cat).map((u) => {
                const cfg = tierConfigs[cat];
                return cfg ? (cfg as any)[u.tier] : null;
              }).filter(Boolean);
              setEnabled((p) => ({ ...p, [cat]: Array.from(new Set(protectedIds)) as string[] }));
            }}
          >
            Limpar
          </Button>
        </div>

        <ScrollArea className="h-[480px] rounded-md border">
          <div className="divide-y">
            {orphans.length > 0 && (
              <div className="p-3 bg-amber-500/5 border-b border-amber-500/20">
                <p className="text-[11px] font-semibold text-amber-600 mb-2">
                  Modelos habilitados mas não encontrados no catálogo atual da OpenRouter:
                </p>
                {orphans.map((id) => (
                  <ModelRow
                    key={id}
                    id={id}
                    name={id}
                    badges={[]}
                    pricing={null}
                    checked
                    onChange={(c) => toggleModel(cat, id, c)}
                  />
                ))}
              </div>
            )}
            {filtered.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {catalog ? 'Nenhum modelo encontrado para esta busca.' : 'Clique em "Atualizar OpenRouter" para carregar.'}
              </div>
            )}
            {filtered.map((m) => {
              const badges: { label: string; tone?: 'in' | 'out' }[] = [];
              if (m.input_modalities.includes('image')) badges.push({ label: 'image-in', tone: 'in' });
              if (m.output_modalities.includes('image')) badges.push({ label: 'image-out', tone: 'out' });
              if (m.input_modalities.includes('audio')) badges.push({ label: 'audio-in', tone: 'in' });
              return (
                <ModelRow
                  key={m.id}
                  id={m.id}
                  name={m.name}
                  badges={badges}
                  pricing={m.pricing}
                  checked={enabledSet.has(m.id)}
                  onChange={(c) => toggleModel(cat, m.id, c)}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const findUsagesAll = (): { category: CategoryKey; tier: string }[] => {
    const all: { category: CategoryKey; tier: string }[] = [];
    (Object.keys(tierConfigs) as CategoryKey[]).forEach((cat) => {
      const cfg = tierConfigs[cat];
      if (!cfg) return;
      (['primary_model', 'fallback_model', 'tertiary_model'] as const).forEach((tier) => {
        all.push({ category: cat, tier });
      });
    });
    return all;
  };

  const syncedLabel = useMemo(() => {
    const ts = catalog?.synced_at ?? enabled.synced_at;
    if (!ts) return 'Nunca sincronizado';
    return 'Atualizado: ' + new Date(ts).toLocaleString('pt-BR');
  }, [catalog, enabled.synced_at]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Catálogo de Modelos OpenRouter</DialogTitle>
            <DialogDescription>
              Selecione quais modelos aparecem nos menus de cada categoria. Modelos em uso na configuração ativa não podem ser desabilitados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou slug..."
                className="pl-8 h-9 text-sm"
              />
            </div>
            <span className="text-[11px] text-muted-foreground hidden md:inline">{syncedLabel}</span>
            <Button size="sm" variant="outline" onClick={() => fetchCatalog(true)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              Atualizar OpenRouter
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CategoryKey)}>
            <TabsList className="grid grid-cols-3 w-full">
              {(Object.keys(CATEGORY_META) as CategoryKey[]).map((k) => (
                <TabsTrigger key={k} value={k} className="text-xs gap-1.5">
                  {CATEGORY_META[k].icon}
                  {CATEGORY_META[k].label}
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {enabled[k].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {(Object.keys(CATEGORY_META) as CategoryKey[]).map((k) => (
              <TabsContent key={k} value={k} className="mt-4">
                {renderList(k)}
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !isDirty}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-2" />
              )}
              Salvar catálogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!blockedModel}
        onOpenChange={(o) => !o && setBlockedModel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modelo em uso</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo <code className="bg-muted px-1 py-0.5 rounded text-foreground">{blockedModel?.modelId}</code> está sendo usado na configuração ativa e não pode ser desabilitado.
              <br /><br />
              <strong>Usado em:</strong>
              <ul className="mt-2 space-y-1">
                {blockedModel?.usages.map((u, i) => (
                  <li key={i} className="text-sm">
                    • {CATEGORY_LABELS[u.category]} — <strong>{TIER_LABELS[u.tier]}</strong>
                  </li>
                ))}
              </ul>
              <br />
              Troque o modelo no card correspondente antes de removê-lo do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockedModel(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ModelRowProps {
  id: string;
  name: string;
  badges: { label: string; tone?: 'in' | 'out' }[];
  pricing: { prompt: number | null; completion: number | null } | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ModelRow({ id, name, badges, pricing, checked, onChange }: ModelRowProps) {
  const fmt = (n: number | null) =>
    n == null ? null : `$${(n * 1_000_000).toFixed(2)}/M`;
  const promptPrice = pricing ? fmt(pricing.prompt) : null;
  const completionPrice = pricing ? fmt(pricing.completion) : null;

  return (
    <label className="flex items-start gap-3 p-3 hover:bg-secondary/40 cursor-pointer transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{name}</span>
          {badges.map((b) => (
            <Badge
              key={b.label}
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-normal"
            >
              {b.label}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <code className="text-[11px] font-mono text-muted-foreground truncate">{id}</code>
          {promptPrice && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              in {promptPrice}{completionPrice && ` · out ${completionPrice}`}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}
