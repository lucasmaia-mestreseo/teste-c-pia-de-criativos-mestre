import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Type, Image, Stamp, Loader2, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import type { SwipeAnalysis } from '@/hooks/useSwipeAnalysis';

export interface ElementOverrides {
  texts: Record<string, { original: string; value: string; action: 'keep' | 'replace' | 'remove' }>;
  logos: Record<string, { action: 'keep' | 'replace' }>;
  photos: Record<string, { action: 'keep' | 'replace' }>;
}

interface Props {
  analysis: SwipeAnalysis | null;
  isPending: boolean;
  overrides: ElementOverrides;
  onChange: (overrides: ElementOverrides) => void;
  hasLogo: boolean;
  hasPersonPhotos: boolean;
  projectContext?: string;
}

const ROLE_LABELS: Record<string, string> = {
  headline: 'Headline',
  subtitle: 'Subtítulo',
  cta: 'CTA',
  caption: 'Legenda',
  body: 'Corpo',
  other: 'Texto',
};

export default function SwipeElementsEditor({ analysis, isPending, overrides, onChange, hasLogo, hasPersonPhotos, projectContext }: Props) {
  const [suggesting, setSuggesting] = useState(false);
  // Initialize overrides when analysis arrives
  useEffect(() => {
    if (!analysis) return;
    const texts: ElementOverrides['texts'] = {};
    analysis.texts.forEach((t) => {
      texts[t.id] = { original: t.content, value: t.content, action: 'keep' };
    });
    const logos: ElementOverrides['logos'] = {};
    analysis.logos.forEach((l) => {
      logos[l.id] = { action: 'keep' };
    });
    const photos: ElementOverrides['photos'] = {};
    analysis.photos.forEach((p) => {
      photos[p.id] = { action: 'keep' };
    });
    onChange({ texts, logos, photos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  if (isPending) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Analisando elementos...
      </div>
    );
  }

  if (!analysis) return null;

  const hasTexts = analysis.texts.length > 0;
  const hasLogos = analysis.logos.length > 0 && hasLogo;
  const hasPhotos = analysis.photos.length > 0 && hasPersonPhotos;

  if (!hasTexts && !hasLogos && !hasPhotos) {
    return (
      <p className="text-[10px] text-muted-foreground">Nenhum elemento editável detectado</p>
    );
  }

  const updateText = (id: string, value: string) => {
    const original = overrides.texts[id]?.original ?? '';
    const action = value === '' ? 'remove' as const : value !== original ? 'replace' as const : 'keep' as const;
    onChange({
      ...overrides,
      texts: { ...overrides.texts, [id]: { original, value, action } },
    });
  };

  const clearText = (id: string) => {
    const original = overrides.texts[id]?.original ?? '';
    onChange({
      ...overrides,
      texts: { ...overrides.texts, [id]: { original, value: '', action: 'remove' } },
    });
  };

  const toggleLogo = (id: string) => {
    const current = overrides.logos[id]?.action ?? 'keep';
    onChange({
      ...overrides,
      logos: { ...overrides.logos, [id]: { action: current === 'keep' ? 'replace' : 'keep' } },
    });
  };

  const togglePhoto = (id: string) => {
    const current = overrides.photos[id]?.action ?? 'keep';
    onChange({
      ...overrides,
      photos: { ...overrides.photos, [id]: { action: current === 'keep' ? 'replace' : 'keep' } },
    });
  };

  const handleSuggest = async () => {
    if (!projectContext?.trim() || !analysis) return;
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-texts', {
        body: { context: projectContext, texts: analysis.texts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const suggestions: { id: string; text: string }[] = data.suggestions ?? [];
      const newTexts = { ...overrides.texts };
      suggestions.forEach((s) => {
        if (newTexts[s.id]) {
          newTexts[s.id] = { original: newTexts[s.id].original, value: s.text, action: 'replace' };
        }
      });
      onChange({ ...overrides, texts: newTexts });
      toast.success('Textos sugeridos pela IA!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao sugerir textos');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Collapsible defaultOpen>
      <div className="flex items-center gap-1">
        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors flex-1">
          <ChevronDown className="h-3 w-3" />
          Elementos detectados ({analysis.texts.length + analysis.logos.length + analysis.photos.length})
        </CollapsibleTrigger>
        {hasTexts && (
          <button
            onClick={handleSuggest}
            disabled={suggesting || !projectContext?.trim()}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!projectContext?.trim() ? 'Preencha o Contexto do projeto primeiro' : 'Sugerir textos com IA'}
          >
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA
          </button>
        )}
      </div>
      <CollapsibleContent className="space-y-1.5 pt-1.5">
        {hasTexts && analysis.texts.map((t) => {
          const ov = overrides.texts[t.id];
          const isRemoved = ov?.action === 'remove';
          const isChanged = ov?.action === 'replace';
          return (
            <div key={t.id} className="flex items-center gap-1.5">
              <Type className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[9px] text-muted-foreground w-14 flex-shrink-0 truncate" title={t.position}>
                {ROLE_LABELS[t.role] || t.role}
              </span>
              <Input
                value={ov?.value ?? t.content}
                onChange={(e) => updateText(t.id, e.target.value)}
                className={`h-6 text-[10px] bg-secondary flex-1 ${isRemoved ? 'line-through text-muted-foreground' : ''} ${isChanged ? 'border-primary/50' : ''}`}
                placeholder="(vazio = remover)"
              />
              <button onClick={() => clearText(t.id)} className="p-0.5 hover:text-destructive text-muted-foreground" title="Remover texto">
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {hasLogos && analysis.logos.map((l) => (
          <div key={l.id} className="flex items-center gap-1.5">
            <Stamp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground flex-1 truncate">{l.description}</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[9px] text-muted-foreground">Meu logo</span>
              <Switch
                checked={overrides.logos[l.id]?.action === 'replace'}
                onCheckedChange={() => toggleLogo(l.id)}
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              />
            </label>
          </div>
        ))}

        {hasPhotos && analysis.photos.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <Image className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground flex-1 truncate">{p.description}</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[9px] text-muted-foreground">Minha foto</span>
              <Switch
                checked={overrides.photos[p.id]?.action === 'replace'}
                onCheckedChange={() => togglePhoto(p.id)}
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              />
            </label>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
