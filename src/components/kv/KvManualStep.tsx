import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, ChevronDown, Code2, FileDown, Loader2, Save, ShieldCheck, TriangleAlert, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { FillResult } from '@/kv/fillTemplate';
import type { ManualSpec } from '@/kv/spec';
import { applyToProject, saveManual } from '@/kv/manualStorage';

interface Props {
  projectId: string;
  spec: ManualSpec;
  result: FillResult;
  logoForKit: string | null;
  photosForKit: string[];
  onBack: () => void;
  onSaved: () => void;
}

export default function KvManualStep({ projectId, spec, result, logoForKit, photosForKit, onBack, onSaved }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const failures = result.log.filter((l) => !l.ok);
  const fileBase = `Manual-${spec.marca.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '') || 'Marca'}`;

  // page tracker inside the iframe
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const onScroll = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const frames = [...doc.querySelectorAll('.frame')];
      const y = doc.documentElement.scrollTop + 120;
      const idx = frames.findIndex((f) => (f as HTMLElement).offsetTop + (f as HTMLElement).offsetHeight > y);
      setPage(Math.max(1, idx + 1));
    };
    const attach = () => frame.contentWindow?.addEventListener('scroll', onScroll);
    frame.addEventListener('load', attach);
    return () => frame.removeEventListener('load', attach);
  }, [result.html]);

  const goTo = (n: number) => {
    const doc = iframeRef.current?.contentDocument;
    const el = doc?.querySelectorAll('.frame')[n - 1] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const printPdf = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    toast.info('Na janela de impressão, escolha "Salvar como PDF".', { description: 'O tamanho da página (1920 × 1080) já vem do manual. Deixe as margens em "Nenhuma".' });
    w.focus();
    w.print();
  };

  const downloadHtml = () => {
    const blob = new Blob([result.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveManual(projectId, spec, result.html);
      setSaved(true);
      onSaved();
      toast.success('Manual salvo no projeto');
    } catch (e) {
      toast.error('Não foi possível salvar', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Editar resumo</Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)} className="gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Aplicar à identidade do cliente</Button>
        <Button size="sm" variant="outline" onClick={downloadHtml} className="gap-1.5"><Code2 className="h-3.5 w-3.5" /> HTML</Button>
        <Button size="sm" variant="outline" onClick={save} disabled={saving || saved} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? 'Salvo' : 'Salvar no projeto'}
        </Button>
        <Button size="sm" onClick={printPdf} className="gap-1.5 font-semibold"><FileDown className="h-3.5 w-3.5" /> Baixar PDF</Button>
      </div>

      {/* QA report */}
      <div className={cn('rounded-xl border text-xs', failures.length || result.remainingMarkers.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5')}>
        <button onClick={() => setLogOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2">
          {failures.length || result.remainingMarkers.length
            ? <TriangleAlert className="h-4 w-4 text-amber-500" />
            : <ShieldCheck className="h-4 w-4 text-emerald-500" />}
          <span className="font-semibold">
            {failures.length || result.remainingMarkers.length
              ? `Conferência: ${failures.length + result.remainingMarkers.length} ponto(s) para revisar`
              : `Conferência: ${result.log.length} etapas de preenchimento concluídas, nenhum marcador sobrando`}
          </span>
          <ChevronDown className={cn('h-4 w-4 ml-auto transition-transform', logOpen && 'rotate-180')} />
        </button>
        {logOpen && (
          <div className="px-3 pb-3 grid md:grid-cols-2 gap-x-6 gap-y-0.5 text-[11px]">
            {result.log.map((l, i) => (
              <div key={i} className={l.ok ? 'text-muted-foreground' : 'text-amber-500 font-medium'}>{l.ok ? '✓' : '!'} {l.label}</div>
            ))}
            {result.remainingMarkers.map((m) => <div key={m} className="text-amber-500">! marcador sem valor: {m.slice(0, 40)}</div>)}
            {result.leftoverTerms.map((m) => <div key={m} className="text-amber-500">! termo de outra marca no texto: {m}</div>)}
          </div>
        )}
      </div>

      {/* preview */}
      <div className="grid lg:grid-cols-[120px_1fr] gap-3">
        <div className="hidden lg:flex flex-col gap-1 max-h-[75vh] overflow-y-auto pr-1">
          {Array.from({ length: 38 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => goTo(n)}
              className={cn('text-left text-[11px] px-2 py-1 rounded-md transition', page === n ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-secondary text-muted-foreground')}>
              {String(n).padStart(2, '0')} · {PAGE_TITLES[n - 1]}
            </button>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl overflow-hidden border bg-[#3a3a3a] shadow-2xl">
          <iframe ref={iframeRef} title="Manual" srcDoc={result.html} className="w-full h-[75vh] block" />
        </motion.div>
      </div>

      <ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} projectId={projectId} spec={spec} logo={logoForKit} photos={photosForKit}
        onDone={() => { qc.invalidateQueries({ queryKey: ['brand_kit', projectId] }); qc.invalidateQueries({ queryKey: ['project', projectId] }); }} />
    </div>
  );
}

const PAGE_TITLES = [
  'Capa', 'Sumário', 'Elementos da marca', 'Logotipo', 'Monocromáticas', 'Proteção', 'Usos indevidos', 'Tipografia',
  'Cores', 'Cores derivadas', 'CTA', 'Imagens', 'Imagens', 'Banners', 'Margens', 'Logo principal', 'Logo reduzido',
  'Feed', 'Story', 'Facebook', 'Banners', 'Exemplos', 'Criativo 01', 'Criativo 02', 'Criativo 03', 'Landing pages',
  'Logotipo LP', 'Margens LP', 'Desktop', 'Desktop', 'Mobile', 'Mobile', 'Auxiliar', 'Auxiliar', 'CTA LP', 'LP exemplo', 'LP topo', 'LP continuação',
];

function ApplyDialog({ open, onOpenChange, projectId, spec, logo, photos, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; spec: ManualSpec; logo: string | null; photos: string[]; onDone: () => void;
}) {
  const [opts, setOpts] = useState({ colors: true, typography: true, logo: !!logo, photos: photos.length > 0, voice: true, guidelines: true });
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    try {
      const done = await applyToProject(projectId, spec, {
        colors: opts.colors, typography: opts.typography, logoDataUrl: opts.logo ? logo : null,
        photos: opts.photos ? photos : [], voice: opts.voice, guidelines: opts.guidelines,
      });
      onDone();
      toast.success('Identidade do cliente atualizada', { description: `${done.join(', ')}. Os próximos criativos já seguem o manual.` });
      onOpenChange(false);
    } catch (e) {
      toast.error('Não foi possível aplicar', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const Row = ({ k, label, hint, disabled }: { k: keyof typeof opts; label: string; hint: string; disabled?: boolean }) => (
    <label className={cn('flex items-start gap-3 rounded-lg border p-3 cursor-pointer', disabled && 'opacity-40 pointer-events-none')}>
      <Checkbox checked={opts[k]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [k]: !!v }))} className="mt-0.5" />
      <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar à identidade do cliente</DialogTitle>
          <DialogDescription>Leva o manual aprovado para o Brand Kit e o Contexto do projeto — o que a geração de criativos usa em todo prompt.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Row k="colors" label="Cores" hint={`Primária ${spec.cores.principal.hex}, secundária ${spec.cores.apoio.hex}, acento ${spec.cores.acento.hex} e paleta`} />
          <Row k="typography" label="Tipografia" hint={[spec.tipografia.primaria, spec.tipografia.secundaria].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')} />
          <Row k="logo" label="Logotipo" hint="Versão colorida, com fundo removido e recorte justo" disabled={!logo} />
          <Row k="photos" label="Fotografias" hint={`${photos.length} foto(s) escolhida(s) no resumo`} disabled={!photos.length} />
          <Row k="voice" label="Tom de voz e público" hint="Somado ao Contexto do projeto, sem apagar o que já existe" />
          <Row k="guidelines" label="Diretrizes visuais para a IA" hint="Regras de cor, CTA e imagem no Contexto — a geração de criativos passa a segui-las" />
        </div>
        <Button onClick={apply} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Aplicar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
