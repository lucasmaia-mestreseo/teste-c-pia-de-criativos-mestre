import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { FlaskConical, Loader2, Sparkles, Star, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGeneratedCreatives, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import {
  formatUsd, invalidateCreatives, reviewCreative, runWithConcurrency, suggestVariants, transformCreative,
  type CreativeReview, type VariantProposal,
} from '@/lib/creativeOps';

const FOCOS = [
  { id: 'mix', label: 'Ângulo da mensagem', hint: 'Cada variação testa uma hipótese: benefício, dor, prova social…' },
  { id: 'headline', label: 'Só a headline', hint: 'Visual e CTA iguais; muda o título' },
  { id: 'cta', label: 'Só o CTA', hint: 'Mesmo criativo; muda o botão' },
  { id: 'visual', label: 'Um elemento visual', hint: 'Mesmos textos; muda enquadramento, fundo ou destaque' },
];

type Creative = { id: string; project_id: string; image_url: string; format: string };

export default function VariantsDialog({ open, onOpenChange, creative }: { open: boolean; onOpenChange: (o: boolean) => void; creative: Creative }) {
  const qc = useQueryClient();
  const [foco, setFoco] = useState('mix');
  const [qtd, setQtd] = useState(3);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<{ headline: string; cta: string } | null>(null);
  const [props, setProps] = useState<(VariantProposal & { on: boolean })[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => { if (open) { setProps([]); setCurrent(null); setProgress(null); } }, [open, creative.id]);

  const suggest = async () => {
    setLoading(true);
    try {
      const r = await suggestVariants(creative.project_id, creative.id, qtd, foco);
      setCurrent(r.textosAtuais);
      setProps(r.variacoes.map((v) => ({ ...v, on: true })));
    } catch (e) {
      toast.error('Não foi possível sugerir variações', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    const chosen = props.filter((p) => p.on);
    if (!chosen.length) return;
    setProgress({ done: 0, total: chosen.length });
    const settled = await runWithConcurrency(chosen, 2, async ({ on: _on, ...variant }) => {
      try {
        const r = await transformCreative({ projectId: creative.project_id, operation: 'variant', creativeId: creative.id, variant });
        invalidateCreatives(qc, creative.project_id);
        void reviewCreative(qc, creative.project_id, r.creativeId);
        return r;
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    });
    setProgress(null);
    const ok = settled.filter((s) => s.status === 'fulfilled').length;
    if (ok) toast.success(`${ok} variação(ões) criada(s)`, { description: 'Compare lado a lado em "Comparar variações".' });
    if (ok < settled.length) toast.error(`${settled.length - ok} variação(ões) falharam`);
    if (ok) onOpenChange(false);
  };

  const running = !!progress;
  const update = (i: number, patch: Partial<VariantProposal & { on: boolean }>) => setProps((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <Dialog open={open} onOpenChange={(o) => !running && !loading && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Variações para teste A/B</DialogTitle>
          <DialogDescription>Cada variação muda uma coisa só — assim o resultado do teste diz o que funcionou. O criativo atual é o controle.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-[120px_1fr] gap-4">
          <div className="space-y-1">
            <img src={creative.image_url} alt="" className="w-full rounded-lg border object-contain bg-secondary" />
            <div className="text-[10px] text-center text-muted-foreground">Controle (A)</div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {FOCOS.map((f) => (
                <button key={f.id} onClick={() => setFoco(f.id)} disabled={loading || running}
                  className={cn('text-left rounded-lg border p-2.5 transition', foco === f.id ? 'border-primary bg-primary/10' : 'hover:border-primary/40')}>
                  <div className="text-xs font-semibold">{f.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">{f.hint}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Quantidade</span>
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => setQtd(n)} disabled={loading || running}
                  className={cn('h-7 w-7 rounded-md border text-xs font-semibold', qtd === n ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-primary/50')}>{n}</button>
              ))}
              <Button size="sm" onClick={suggest} disabled={loading || running} className="ml-auto h-8 gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {props.length ? 'Sugerir de novo' : 'Sugerir variações'}
              </Button>
            </div>
          </div>
        </div>

        {current && (
          <p className="text-[11px] text-muted-foreground">Controle: <b className="text-foreground">"{current.headline}"</b> · CTA <b className="text-foreground">{current.cta}</b></p>
        )}

        <div className="space-y-2">
          {props.map((p, i) => (
            <div key={i} className={cn('rounded-xl border p-3 space-y-2 transition animate-in fade-in slide-in-from-bottom-1', p.on ? 'border-primary/40 bg-card' : 'opacity-60')} style={{ animationDelay: `${i * 60}ms` }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={p.on} onCheckedChange={(v) => update(i, { on: !!v })} className="mt-0.5" disabled={running} />
                <div className="flex-1">
                  <div className="text-sm font-semibold"><span className="text-primary">{String.fromCharCode(66 + i)}</span> · {p.nome}</div>
                  <div className="text-[11px] text-muted-foreground">{p.hipotese}</div>
                </div>
              </label>
              <div className="grid sm:grid-cols-[1fr_180px] gap-2 pl-6">
                <Input value={p.headline} onChange={(e) => update(i, { headline: e.target.value })} className="h-8 text-xs bg-secondary" placeholder="Headline" disabled={running} />
                <Input value={p.cta} onChange={(e) => update(i, { cta: e.target.value.toUpperCase() })} className="h-8 text-xs bg-secondary" placeholder="CTA" disabled={running} />
                <Input value={p.ajusteVisual} onChange={(e) => update(i, { ajusteVisual: e.target.value })} className="h-8 text-xs bg-secondary sm:col-span-2" placeholder="Ajuste visual (opcional)" disabled={running} />
              </div>
            </div>
          ))}
        </div>

        {progress && (
          <div className="space-y-1">
            <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">{progress.done} de {progress.total} variações prontas…</p>
          </div>
        )}

        {props.length > 0 && (
          <Button onClick={generate} disabled={running || !props.some((p) => p.on)} className="w-full gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Gerar {props.filter((p) => p.on).length} variação(ões)
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Side-by-side A/B comparison: control + its variants, with review score, cost and "winner" (favorite). */
export function CompareVariantsDialog({ open, onOpenChange, creative }: { open: boolean; onOpenChange: (o: boolean) => void; creative: Creative }) {
  const { data: creatives } = useGeneratedCreatives(creative.project_id);
  const toggleFavorite = useToggleFavorite();
  const items = useMemo(() => {
    const all = (creatives ?? []) as Array<Creative & { parent_creative_id?: string | null; generation_meta?: any; review?: unknown; cost_usd?: number | null; favorite?: boolean; prompt: string }>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const control = all.find((c) => c.id === creative.id);
    const variants = all.filter((c) => c.parent_creative_id === creative.id && c.generation_meta?.operation === 'variant');
    return control ? [control, ...variants] : variants;
  }, [creatives, creative.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Comparar variações</DialogTitle>
          <DialogDescription>Suba as versões no gerenciador de anúncios com o mesmo público e orçamento. Marque a vencedora com a estrela quando o teste acabar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, items.length))}, minmax(0,1fr))` }}>
          {items.map((c, i) => {
            const review = c.review as CreativeReview | null;
            const v = c.generation_meta?.variant as VariantProposal | undefined;
            return (
              <div key={c.id} className={cn('rounded-xl border overflow-hidden bg-card animate-in fade-in zoom-in-95', c.favorite && 'border-primary shadow-lg shadow-primary/10')} style={{ animationDelay: `${i * 70}ms` }}>
                <div className="relative bg-secondary">
                  <img src={c.image_url} alt="" className="w-full aspect-square object-contain" />
                  <span className="absolute top-2 left-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow">{String.fromCharCode(65 + i)}</span>
                  {c.favorite && <Trophy className="absolute top-2 right-2 h-6 w-6 text-primary drop-shadow" />}
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="font-semibold">{i === 0 ? 'Controle' : v?.nome ?? 'Variação'}</div>
                  {v?.hipotese && <div className="text-muted-foreground leading-snug">{v.hipotese}</div>}
                  {v?.headline && <div>“{v.headline}”</div>}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>{review ? `Revisão ${review.score}` : 'Sem revisão'}</span>
                    <span>{formatUsd(c.cost_usd)}</span>
                  </div>
                  <Button size="sm" variant={c.favorite ? 'default' : 'outline'} className="w-full h-7 text-[11px] gap-1"
                    onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !c.favorite })}>
                    <Star className={cn('h-3 w-3', c.favorite && 'fill-current')} /> {c.favorite ? 'Vencedora' : 'Marcar vencedora'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {items.length <= 1 && <p className="text-sm text-muted-foreground">Nenhuma variação ainda. Use "Variações A/B" para criar.</p>}
      </DialogContent>
    </Dialog>
  );
}
