import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, ShieldCheck, Lightbulb, Rocket } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import { reviewCreative, runWithConcurrency } from '@/lib/creativeOps';
import { Progress } from '@/components/ui/progress';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useCreativeFormats } from '@/hooks/useCreativeFormats';
import { usePermissions } from '@/hooks/usePermissions';
import { useQueryClient } from '@tanstack/react-query';

interface DynamicGeneratePanelProps {
  projectId: string | null;
  onGeneratingChange?: (generating: boolean) => void;
}

/** Parallel requests to the image provider; more than this tends to hit rate limits. */
const CONCURRENCY = 2;

const TYPE_CONFIG = [
  {
    id: 'conservative' as const,
    label: 'Conservadores',
    description: 'Linguagem direta, provas sociais, benefícios concretos',
    icon: ShieldCheck,
    color: 'text-blue-400',
  },
  {
    id: 'innovative' as const,
    label: 'Inovadores',
    description: 'Abordagens novas, metáforas visuais, storytelling incomum',
    icon: Lightbulb,
    color: 'text-amber-400',
  },
  {
    id: 'radical' as const,
    label: 'Fora da Caixa',
    description: 'Disruptivos, virais, provocativos, não convencionais',
    icon: Rocket,
    color: 'text-rose-400',
  },
];

export default function DynamicGeneratePanel({ projectId, onGeneratingChange }: DynamicGeneratePanelProps) {
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({
    conservative: 2,
    innovative: 2,
    radical: 1,
  });
  const [format, setFormat] = useState<string>('1:1');
  const [ignoreBrandKit, setIgnoreBrandKit] = useState(false);
  const [ignoreContext, setIgnoreContext] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { data: brandKit } = useBrandKit(projectId);
  const hasLogo = !!brandKit?.logo_url;

  const { data: formats } = useCreativeFormats();
  const qc = useQueryClient();
  const { can } = usePermissions();

  const formatLabels = (formats || []).map((f: any) => f.label as string);
  const FORMATS = formatLabels.length > 0 ? formatLabels : ['9:16', '4:5', '1:1', '16:9'];

  const toggleType = (id: string) => {
    setSelectedTypes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const anySelected = Object.values(selectedTypes).some(Boolean);

  const handleGenerate = async () => {
    if (!projectId || !anySelected) return;
    setGenerating(true);
    onGeneratingChange?.(true);

    // One request per creative: each stays well under the Edge Function time limit,
    // results show up as they finish, and one failure does not lose the whole batch.
    const jobs = Object.entries(selectedTypes)
      .filter(([, v]) => v)
      .flatMap(([type]) => Array.from({ length: counts[type] || 1 }, () => type));
    setProgress({ done: 0, total: jobs.length });

    try {
      const settled = await runWithConcurrency(jobs, CONCURRENCY, async (type) => {
        try {
          const data = await invokeWithRetry('generate-dynamic-creative', {
            projectId,
            types: [{ type, count: 1 }],
            format,
            ignoreBrandKit,
            ignoreContext,
            includeLogo: includeLogo && hasLogo,
            customPrompt: customPrompt.trim() || undefined,
          }, { friendlyName: 'Geração Dinâmica', projectId, maxRetries: 2 });
          qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
          for (const r of data.results ?? []) {
            if (r.creativeId) void reviewCreative(qc, projectId, r.creativeId);
          }
          return (data.results ?? []).filter((r: any) => r.imageUrl).length as number;
        } finally {
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      });

      const ok = settled.reduce((n, r) => n + (r.status === 'fulfilled' ? r.value : 0), 0);
      const failed = jobs.length - ok;
      if (ok > 0) toast.success(`${ok} criativo${ok > 1 ? 's' : ''} gerado${ok > 1 ? 's' : ''}!`);
      if (failed > 0) {
        const firstError = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        toast.error(`${failed} de ${jobs.length} não foram gerados`, {
          description: firstError?.reason?.message,
        });
      }
    } finally {
      setGenerating(false);
      onGeneratingChange?.(false);
      setProgress(null);
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
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Geração Dinâmica</h2>
      </div>

      <div className="space-y-2">
        {TYPE_CONFIG.map(({ id, label, description, icon: Icon, color }) => (
          <div key={id} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
            <Checkbox
              checked={!!selectedTypes[id]}
              onCheckedChange={() => toggleType(id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
              {selectedTypes[id] && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                    <span className="text-[10px] font-semibold">{counts[id]}</span>
                  </div>
                  <Slider
                    value={[counts[id]]}
                    onValueChange={([v]) => setCounts(prev => ({ ...prev, [id]: v }))}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Instruções adicionais para a geração... (opcional)"
          className="min-h-[60px] text-xs bg-secondary resize-none"
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={ignoreBrandKit} onCheckedChange={(v) => setIgnoreBrandKit(!!v)} className="h-3.5 w-3.5" />
          <span className="text-[10px] text-muted-foreground">Ignorar Brand Kit</span>
        </label>
        {hasLogo && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={includeLogo && !ignoreBrandKit} disabled={ignoreBrandKit} onCheckedChange={(v) => setIncludeLogo(!!v)} className="h-3.5 w-3.5" />
            <span className="text-[10px] text-muted-foreground">Incluir logo</span>
          </label>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={ignoreContext} onCheckedChange={(v) => setIgnoreContext(!!v)} className="h-3.5 w-3.5" />
          <span className="text-[10px] text-muted-foreground">Ignorar Contexto</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[80px] bg-secondary h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleGenerate}
          disabled={generating || !anySelected || !can('generate_creative')}
          className="flex-1 h-8 text-xs"
        >
          {generating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Gerando{progress ? ` ${progress.done}/${progress.total}` : '...'}</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar Criativos</>
          )}
        </Button>
      </div>

      {progress && (
        <div className="space-y-1">
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">
            {progress.done} de {progress.total} concluídos — os criativos aparecem à direita conforme ficam prontos.
          </p>
        </div>
      )}
    </div>
  );
}
