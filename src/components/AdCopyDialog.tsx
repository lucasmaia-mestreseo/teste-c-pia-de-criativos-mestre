import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Copy, Loader2, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateAdCopy, invalidateCreatives, type AdCopy } from '@/lib/creativeOps';

const OBJETIVOS = [
  { id: 'conversao', label: 'Conversão (venda/cadastro)' },
  { id: 'leads', label: 'Geração de leads' },
  { id: 'trafego', label: 'Tráfego para o site' },
  { id: 'reconhecimento', label: 'Reconhecimento de marca' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creative: { id: string; project_id: string; image_url: string; generation_meta?: unknown };
}

export default function AdCopyDialog({ open, onOpenChange, creative }: Props) {
  const qc = useQueryClient();
  const saved = (creative.generation_meta as { adCopy?: AdCopy } | null)?.adCopy ?? null;
  const [copy, setCopy] = useState<AdCopy | null>(saved);
  const [objetivo, setObjetivo] = useState(saved?.objetivo ?? 'conversao');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setCopy(saved); }, [open, creative.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setBusy(true);
    try {
      const r = await generateAdCopy(creative.project_id, creative.id, objetivo, obs.trim() || undefined);
      setCopy(r.adCopy);
      invalidateCreatives(qc, creative.project_id);
    } catch (e) {
      toast.error('Não foi possível escrever a copy', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4 text-primary" /> Copy do anúncio</DialogTitle>
          <DialogDescription>Texto que acompanha este criativo em cada plataforma — no tom e nas diretrizes da marca, dentro dos limites de caracteres.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-[120px_1fr] gap-4">
          <img src={creative.image_url} alt="" className="w-full rounded-lg border object-contain bg-secondary" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Select value={objetivo} onValueChange={setObjetivo}>
                <SelectTrigger className="h-8 text-xs w-[220px] bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>{OBJETIVOS.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={generate} disabled={busy} className="h-8 gap-1.5">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : copy ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {copy ? 'Escrever de novo' : 'Escrever copy'}
              </Button>
            </div>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações (opcional): oferta, prazo, público específico, palavras a evitar…" className="min-h-[52px] text-xs bg-secondary resize-none" />
          </div>
        </div>

        {busy && !copy && (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-secondary" />)}
          </div>
        )}

        {copy && (
          <Tabs defaultValue="meta" className={cn('animate-in fade-in duration-300', busy && 'opacity-50 pointer-events-none')}>
            <TabsList className="grid grid-cols-5">
              <TabsTrigger value="meta" className="text-xs">Meta Ads</TabsTrigger>
              <TabsTrigger value="instagram" className="text-xs">Instagram</TabsTrigger>
              <TabsTrigger value="linkedin" className="text-xs">LinkedIn</TabsTrigger>
              <TabsTrigger value="google" className="text-xs">Google Ads</TabsTrigger>
              <TabsTrigger value="ab" className="text-xs">Ângulos A/B</TabsTrigger>
            </TabsList>
            <TabsContent value="meta" className="space-y-2">
              <Field label="Texto principal" value={copy.meta.textoPrincipal} soft={125} multiline hint="Os primeiros 125 caracteres aparecem antes do 'ver mais'" />
              <div className="grid sm:grid-cols-3 gap-2">
                <Field label="Título" value={copy.meta.titulo} max={40} />
                <Field label="Descrição" value={copy.meta.descricao} max={30} />
                <Field label="Botão" value={copy.meta.botao} />
              </div>
            </TabsContent>
            <TabsContent value="instagram" className="space-y-2">
              <Field label="Legenda" value={`${copy.instagram.legenda}\n\n${copy.instagram.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`} multiline soft={2200} />
            </TabsContent>
            <TabsContent value="linkedin"><Field label="Texto do post" value={copy.linkedin.texto} multiline soft={3000} /></TabsContent>
            <TabsContent value="google" className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">{copy.google.titulos.map((t, i) => <Field key={i} label={`Título ${i + 1}`} value={t} max={30} />)}</div>
              {copy.google.descricoes.map((d, i) => <Field key={i} label={`Descrição ${i + 1}`} value={d} max={90} />)}
            </TabsContent>
            <TabsContent value="ab" className="space-y-2">
              {copy.variacoes.map((v, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="text-xs font-semibold text-primary">{v.angulo}</div>
                  <Field label="Texto principal" value={v.textoPrincipal} soft={125} multiline />
                  <Field label="Título" value={v.titulo} max={40} />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, max, soft, multiline, hint }: { label: string; value: string; max?: number; soft?: number; multiline?: boolean; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const len = [...(value ?? '')].length;
  const over = max !== undefined && len > max;
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="rounded-lg border bg-card p-2.5 group">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {(max || soft) && <span className={cn('text-[10px] tabular-nums', over ? 'text-destructive font-semibold' : 'text-muted-foreground/70')}>{len}{max ? `/${max}` : soft ? ` · ideal ${soft}` : ''}</span>}
          <button onClick={copy} className="text-muted-foreground hover:text-primary transition" title="Copiar">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className={cn('text-sm leading-relaxed', multiline && 'whitespace-pre-wrap')}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
