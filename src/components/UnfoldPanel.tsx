import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronDown, ImageUp, Layers, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useGeneratedCreatives } from '@/hooks/useGeneratedCreatives';
import { useFormatOptions } from '@/hooks/useCreativeFormats';
import { invalidateCreatives, reviewCreative, runWithConcurrency, transformCreative } from '@/lib/creativeOps';
import { formatName } from '@/lib/formatNames';
import ActiveGuideBadge from '@/components/kv/ActiveGuideBadge';
import { getCurrentTaskId, nextBannerNumber } from '@/hooks/useTasks';
import TaskNotice from '@/components/TaskNotice';

/** A key visual the other formats are derived from. */
type Source =
  | { id: string; type: 'upload'; storageUrl: string; previewUrl: string; format: string | null; width: number; height: number; name: string }
  | { id: string; type: 'creative'; creativeId: string; previewUrl: string; format: string; width: number; height: number; name: string; taskId?: string | null; bannerNumber?: number | null };

type Status = 'queued' | 'running' | 'done' | 'error';

const MAX_SOURCES = 10;
/** Formats only the Desdobramento offers, on top of the project's formats. */
const EXTRA_FORMATS = ['3:4', '1.91:1'];
const FORMAT_HINTS: Record<string, string> = {
  '9:16': 'Stories e Reels',
  '4:5': 'Feed vertical',
  '1:1': 'Feed quadrado',
  '16:9': 'Display e YouTube',
  '1.91:1': 'Banner Facebook',
  '3:4': 'Feed 3:4',
};
const TIPS = ['No 9:16, subir a headline', 'No 16:9, pessoa à esquerda', 'Manter o CTA grande', 'Logo sempre no topo'];

const ratioOf = (f: string) => { const [w, h] = f.split(':').map(Number); return w && h ? w / h : 1; };

/** Closest known format to the image's proportions (null if nothing is close). */
function nearestFormat(width: number, height: number, options: string[]): string | null {
  const ratio = width / height;
  let best: { f: string; diff: number } | null = null;
  for (const f of options) {
    const diff = Math.abs(Math.log(ratio / ratioOf(f)));
    if (!best || diff < best.diff) best = { f, diff };
  }
  return best && best.diff < 0.04 ? best.f : null;
}

function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

interface UnfoldPanelProps {
  projectId: string;
  /** Formats still being generated (the results side shows placeholders in their shape). */
  onPendingChange?: (formats: string[]) => void;
}

export default function UnfoldPanel({ projectId, onPendingChange }: UnfoldPanelProps) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const projectFormats = useFormatOptions();
  const options = [...projectFormats, ...EXTRA_FORMATS.filter((f) => !projectFormats.includes(f))];
  const { data: creatives } = useGeneratedCreatives(projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  /** key = `${sourceId}|${format}` */
  const [status, setStatus] = useState<Record<string, Status>>({});

  const entries = Object.entries(status);
  const running = entries.some(([, s]) => s === 'queued' || s === 'running');
  const pending = entries.filter(([, s]) => s === 'queued' || s === 'running').map(([k]) => k.split('|')[1]);
  const pendingKey = pending.join(',');
  useEffect(() => { onPendingChange?.(pendingKey ? pendingKey.split(',') : []); }, [pendingKey, onPendingChange]);

  const recent = (creatives || []).filter((c) => c.kind !== 'unfold').slice(0, 16);
  const jobs = sources.flatMap((s) => selected.filter((f) => f !== s.format).map((f) => ({ source: s, format: f })));
  const first = sources[0];

  const firstSelection = (list: Source[]) => {
    // on the first piece, pre-select every format but its own
    if (!selected.length && list.length) setSelected(options.filter((f) => f !== list[0].format));
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast.error('Envie imagens (PNG, JPG ou WEBP)'); return; }
    const room = MAX_SOURCES - sources.length;
    if (list.length > room) toast.info(`Até ${MAX_SOURCES} peças por vez — ${room > 0 ? `entraram as ${room} primeiras` : 'remova alguma para adicionar'}.`);
    const added: Source[] = [];
    for (const [i, file] of list.slice(0, Math.max(0, room)).entries()) {
      setUploading(`Enviando ${i + 1} de ${Math.min(list.length, room)}…`);
      try {
        const previewUrl = URL.createObjectURL(file);
        const { width, height } = await readImageSize(previewUrl);
        const ext = file.name.split('.').pop() || 'png';
        const path = `${projectId}/sources/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('generated-creatives').upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('generated-creatives').getPublicUrl(path);
        added.push({ id: crypto.randomUUID(), type: 'upload', storageUrl: publicUrl, previewUrl, format: nearestFormat(width, height, options), width, height, name: file.name });
      } catch (e) {
        toast.error(`Erro ao enviar ${file.name}`, { description: e instanceof Error ? e.message : undefined });
      }
    }
    setUploading(null);
    if (added.length) {
      const next = [...sources, ...added];
      setSources(next);
      firstSelection(next);
      setStatus({});
    }
  };

  const toggleCreative = async (c: { id: string; image_url: string; format: string; task_id?: string | null; banner_number?: number | null }) => {
    const existing = sources.find((s) => s.type === 'creative' && s.creativeId === c.id);
    if (existing) { setSources((ss) => ss.filter((s) => s.id !== existing.id)); return; }
    if (sources.length >= MAX_SOURCES) { toast.info(`Até ${MAX_SOURCES} peças por vez.`); return; }
    const size = await readImageSize(c.image_url).catch(() => ({ width: ratioOf(c.format) * 1000, height: 1000 }));
    const next: Source[] = [...sources, { id: crypto.randomUUID(), type: 'creative', creativeId: c.id, previewUrl: c.image_url, format: c.format, ...size, name: `Criativo ${c.format}`, taskId: c.task_id ?? null, bannerNumber: c.banner_number ?? null }];
    setSources(next);
    firstSelection(next);
    setStatus({});
  };

  const removeSource = (id: string) => {
    const next = sources.filter((s) => s.id !== id);
    setSources(next);
    if (!next.length) setSelected([]);
    setStatus({});
  };

  const toggle = (f: string) => setSelected((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));
  const presets: { label: string; formats: string[] }[] = [
    { label: 'Todos', formats: options },
    { label: 'Redes sociais', formats: options.filter((f) => ratioOf(f) <= 1) },
    { label: 'Horizontais', formats: options.filter((f) => ratioOf(f) > 1) },
  ].filter((p) => p.formats.length);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  /** Bxx of each piece-mãe: all its formats share it. A piece already in this task keeps its number. */
  const bannerOf = useRef<Record<string, number>>({});
  const assignBanners = async () => {
    const taskId = getCurrentTaskId(projectId);
    bannerOf.current = {};
    if (!taskId) return;
    let next = await nextBannerNumber(taskId);
    for (const s of sources) {
      if (s.type === 'creative' && s.taskId === taskId && s.bannerNumber) bannerOf.current[s.id] = s.bannerNumber;
      else bannerOf.current[s.id] = next++;
    }
  };

  const handleRun = async () => {
    if (!jobs.length) return;
    const list = [...jobs];
    await assignBanners();
    setStatus(Object.fromEntries(list.map((j) => [`${j.source.id}|${j.format}`, 'queued' as Status])));

    const settled = await runWithConcurrency(list, 3, async ({ source, format }) => {
      const key = `${source.id}|${format}`;
      setStatus((s) => ({ ...s, [key]: 'running' }));
      try {
        const r = await transformCreative({
          projectId,
          operation: 'unfold',
          targetFormat: format,
          bannerNumber: bannerOf.current[source.id], sourceRatio: source.width / source.height,
          instructions: instructions.trim() || undefined,
          ...(source.type === 'upload'
            ? { sourceImageUrl: source.storageUrl, sourceFormat: source.format ?? undefined }
            : { creativeId: source.creativeId }),
        });
        invalidateCreatives(qc, projectId);
        void reviewCreative(qc, projectId, r.creativeId);
        setStatus((s) => ({ ...s, [key]: 'done' }));
        return r;
      } catch (e) {
        setStatus((s) => ({ ...s, [key]: 'error' }));
        throw e;
      }
    });

    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const failed = settled.length - ok;
    if (ok) toast.success(`Desdobramento pronto: ${ok} versão${ok > 1 ? 'ões' : ''}`, { description: sources.length > 1 ? `${sources.length} peças-mãe, agrupadas à direita.` : 'As versões estão à direita, junto da peça-mãe.' });
    if (failed) {
      const err = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      toast.error(`${failed} versão(ões) falharam`, { description: err?.reason?.message });
    }
    // failures stay visible so they can be retried; successful rounds reset after a moment
    if (!failed) setTimeout(() => setStatus({}), 3500);
  };

  const retryFailed = () => {
    const failedKeys = entries.filter(([, s]) => s === 'error').map(([k]) => k);
    if (!failedKeys.length) return;
    setStatus({});
    // re-run only the failed pairs by narrowing temporarily
    const failedJobs = failedKeys.map((k) => { const [id, f] = k.split('|'); return { source: sources.find((s) => s.id === id)!, format: f }; }).filter((j) => j.source);
    void (async () => {
      setStatus(Object.fromEntries(failedJobs.map((j) => [`${j.source.id}|${j.format}`, 'queued' as Status])));
      await runWithConcurrency(failedJobs, 3, async ({ source, format }) => {
        const key = `${source.id}|${format}`;
        setStatus((s) => ({ ...s, [key]: 'running' }));
        try {
          const r = await transformCreative({
            projectId, operation: 'unfold', targetFormat: format, bannerNumber: bannerOf.current[source.id], sourceRatio: source.width / source.height, instructions: instructions.trim() || undefined,
            ...(source.type === 'upload' ? { sourceImageUrl: source.storageUrl, sourceFormat: source.format ?? undefined } : { creativeId: source.creativeId }),
          });
          invalidateCreatives(qc, projectId);
          void reviewCreative(qc, projectId, r.creativeId);
          setStatus((s) => ({ ...s, [key]: 'done' }));
        } catch {
          setStatus((s) => ({ ...s, [key]: 'error' }));
        }
      });
    })();
  };

  const done = entries.filter(([, s]) => s === 'done' || s === 'error').length;
  const errors = entries.filter(([, s]) => s === 'error').length;
  const total = entries.length;
  const pieceStatus = (id: string) => {
    const mine = entries.filter(([k]) => k.startsWith(`${id}|`));
    return { total: mine.length, done: mine.filter(([, s]) => s === 'done').length, error: mine.some(([, s]) => s === 'error'), running: mine.some(([, s]) => s === 'running') };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5"
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); } }}>
        {/* header */}
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Layers className="h-4 w-4" /></span>
            <h2 className="text-sm font-bold">Desdobramento</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            Peças aprovadas viram todos os formatos da campanha, com os mesmos textos, logo e pessoas — só a composição se adapta. Uma ou várias de uma vez.
          </p>
          <ActiveGuideBadge projectId={projectId} className="mt-2" />
          <TaskNotice projectId={projectId} className="mt-2" />
        </div>

        {/* key visuals */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel done={sources.length > 0}>Peças-mãe</SectionLabel>
            {sources.length > 0 && <span className="text-[10px] text-muted-foreground">{sources.length} de {MAX_SOURCES}</span>}
          </div>
          <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }} />

          {sources.length === 0 ? (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!uploading}
              className={cn('w-full rounded-xl border-2 border-dashed px-4 py-5 flex items-center gap-4 text-left transition-all duration-300',
                dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/50 hover:bg-secondary/40')}>
              <FanDiagram active={dragOver} />
              <span className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <ImageUp className="h-3.5 w-3.5 text-primary" />}
                  {uploading ?? (dragOver ? 'Pode soltar' : 'Arraste uma ou várias peças')}
                </span>
                <span className="block text-[11px] text-muted-foreground">ou clique para escolher · até {MAX_SOURCES} · PNG, JPG ou WEBP</span>
              </span>
            </button>
          ) : (
            <div className={cn('grid grid-cols-3 gap-2 rounded-xl transition-all', dragOver && 'ring-2 ring-primary ring-offset-2 ring-offset-card')}>
              {sources.map((s) => {
                const st = pieceStatus(s.id);
                return (
                  <div key={s.id} className="group relative rounded-lg border bg-secondary/40 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                    <div className="aspect-square checkerboard flex items-center justify-center">
                      <img src={s.previewUrl} alt={s.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="px-1.5 py-1 text-[10px] flex items-center justify-between gap-1">
                      <span className="font-semibold">{s.format ? formatName(s.format) : `${s.width}×${s.height}`}</span>
                      {st.total > 0 && (
                        <span className={cn('tabular-nums', st.error ? 'text-destructive' : st.done === st.total ? 'text-primary' : 'text-muted-foreground')}>
                          {st.running && <Loader2 className="inline h-2.5 w-2.5 animate-spin mr-0.5" />}{st.done}/{st.total}
                        </span>
                      )}
                    </div>
                    {!running && (
                      <button onClick={() => removeSource(s.id)} title="Tirar esta peça"
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/85 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {st.total > 0 && st.done === st.total && <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in duration-300"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
                  </div>
                );
              })}
              {sources.length < MAX_SOURCES && !running && (
                <button onClick={() => inputRef.current?.click()} disabled={!!uploading}
                  className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors min-h-[90px]">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {uploading ?? 'Adicionar'}
                </button>
              )}
            </div>
          )}

          {recent.length > 0 && !running && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">{sources.length ? 'ou acrescente' : 'ou parta de'} criativos do projeto</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                {recent.map((c) => {
                  const picked = sources.some((s) => s.type === 'creative' && s.creativeId === c.id);
                  return (
                    <button key={c.id} onClick={() => void toggleCreative(c)} title={c.format}
                      className={cn('group relative h-14 w-14 flex-none rounded-lg border overflow-hidden bg-secondary transition-all duration-200 hover:-translate-y-0.5',
                        picked ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-primary/60')}>
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                      {picked && <span className="absolute inset-0 bg-primary/30 flex items-center justify-center"><Check className="h-4 w-4 text-primary-foreground drop-shadow" strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* formats, previewed with the first key visual inside each frame */}
        <section className={cn('space-y-2.5 transition-opacity duration-300', !sources.length && 'opacity-40 pointer-events-none')}>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel done={sources.length > 0 && selected.length > 0}>Formatos</SectionLabel>
            <div className="flex gap-1">
              {presets.map((p) => (
                <button key={p.label} onClick={() => setSelected(p.formats)} disabled={running}
                  className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors',
                    same(selected, p.formats) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:border-primary/40')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((f) => (
              <FormatCard key={f} format={f} image={first?.previewUrl} active={selected.includes(f)}
                status={sources.length === 1 ? status[`${sources[0].id}|${f}`] : undefined}
                skipped={sources.length === 1 && sources[0].format === f}
                onClick={() => !running && toggle(f)} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {sources.length > 1 ? 'Cada peça pula o formato que ela já tem.' : first?.format ? `A peça-mãe já é ${formatName(first.format)}: esse formato fica de fora.` : ''}
            {selected.includes('1.91:1') && ' O 1200×628 sai no tamanho exato do banner de link do Facebook.'}
          </p>
        </section>

        {/* adjustments */}
        <section className={cn('transition-opacity duration-300', !sources.length && 'opacity-40 pointer-events-none')}>
          <button onClick={() => setAdjustOpen((v) => !v)} className="w-full flex items-center gap-2 text-left">
            <SectionLabel>Ajustes finos</SectionLabel>
            <span className="text-[10px] text-muted-foreground">opcional · vale para todas as peças</span>
            <ChevronDown className={cn('h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform duration-300', adjustOpen && 'rotate-180')} />
          </button>
          <div className={cn('grid transition-all duration-300 ease-out', adjustOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0')}>
            <div className="overflow-hidden space-y-2">
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={running}
                placeholder="O que a IA deve respeitar ao recompor cada formato"
                className="min-h-[60px] text-xs bg-secondary resize-none" />
              <div className="flex flex-wrap gap-1">
                {TIPS.map((t) => (
                  <button key={t} disabled={running} onClick={() => setInstructions((v) => (v.trim() ? `${v.trim()}; ${t.toLowerCase()}` : t))}
                    className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* action */}
      <div className="border-t p-3 bg-card/80 backdrop-blur space-y-2">
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
              <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${((done - errors) / total) * 100}%` }} />
              <div className="h-full bg-destructive transition-all duration-700 ease-out" style={{ width: `${(errors / total) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{done} de {total} versões{errors ? ` · ${errors} falharam` : ''}</span>
              {!running && errors > 0 && <button onClick={retryFailed} className="text-primary hover:underline">Tentar de novo as que falharam</button>}
            </div>
          </div>
        )}
        <Button onClick={handleRun} disabled={!jobs.length || running || !can('generate_creative')} className={cn('w-full h-10 gap-2 font-semibold', !running && jobs.length > 0 && 'btn-shine')}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? `Desdobrando… ${done} de ${total}`
            : !sources.length ? 'Escolha as peças-mãe'
              : !jobs.length ? 'Escolha os formatos'
                : sources.length === 1 ? `Desdobrar em ${jobs.length} formato${jobs.length > 1 ? 's' : ''}`
                  : `Desdobrar ${sources.length} peças · ${jobs.length} versões`}
        </Button>
        {running && <p className="text-[10px] text-center text-muted-foreground">3 versões por vez, cada uma de 30 a 90 segundos. Pode continuar navegando.</p>}
      </div>
    </div>
  );
}

function SectionLabel({ children, done }: { children: React.ReactNode; done?: boolean }) {
  return (
    <p className="text-[11px] font-semibold flex items-center gap-1.5">
      <span className={cn('h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all duration-300', done ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/40')}>
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      {children}
    </p>
  );
}

/** One target format: the key visual placed inside the target frame, so people see what will be recomposed. */
function FormatCard({ format, image, active, status, skipped, onClick }: { format: string; image?: string; active: boolean; status?: Status; skipped?: boolean; onClick: () => void }) {
  const r = ratioOf(format);
  const H = 76;
  const W = Math.min(124, Math.round(H * r));
  const h = r > 1 ? Math.round(W / r) : H;
  return (
    <button onClick={onClick}
      className={cn('group relative rounded-xl border p-2.5 flex flex-col items-center gap-2 transition-all duration-200',
        skipped ? 'opacity-35' : active ? 'border-primary/70 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]' : 'opacity-60 hover:opacity-100 hover:border-primary/40')}>
      <div className="h-[76px] flex items-center justify-center">
        <div className={cn('relative rounded-[4px] overflow-hidden border border-white/10 bg-secondary transition-transform duration-300', active && 'group-hover:scale-[1.04]', status === 'running' && 'generating-pulse')}
          style={{ width: W, height: h }}>
          {image && <>
            <img src={image} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50" />
            <img src={image} alt="" className="absolute inset-0 w-full h-full object-contain" />
          </>}
          {status === 'done' && <span className="absolute inset-0 bg-primary/25 flex items-center justify-center animate-in fade-in duration-300"><Check className="h-5 w-5 text-primary-foreground drop-shadow" strokeWidth={3} /></span>}
        </div>
      </div>
      <div className="text-center leading-tight">
        <div className="text-[11px] font-bold">{formatName(format)}</div>
        <div className="text-[9.5px] text-muted-foreground">{skipped ? 'formato da peça-mãe' : FORMAT_HINTS[format] ?? 'Formato personalizado'}</div>
      </div>
      <span className={cn('absolute top-1.5 right-1.5 h-4 w-4 rounded-full border flex items-center justify-center transition-all duration-200',
        active && !skipped ? 'bg-primary border-primary text-primary-foreground scale-100' : 'scale-90 border-muted-foreground/40')}>
        {active && !skipped && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

/** "1 piece → many formats", the idea of the tool in one glance. */
function FanDiagram({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 92 56" className={cn('h-14 w-[92px] flex-none text-primary transition-transform duration-500', active && 'scale-105')} fill="none" aria-hidden>
      <rect x="2" y="14" width="24" height="28" rx="3" className="fill-primary/20" stroke="currentColor" strokeWidth="1.6" />
      <path d="M30 28h10" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
      <path d="M40 28l14-20M40 28l14-5M40 28l14 8M40 28l14 20" className="stroke-muted-foreground/50" strokeWidth="1" />
      <rect x="56" y="2" width="9" height="16" rx="1.5" className="stroke-muted-foreground" strokeWidth="1.3" />
      <rect x="69" y="4" width="12" height="12" rx="1.5" className="stroke-muted-foreground" strokeWidth="1.3" />
      <rect x="56" y="24" width="12" height="15" rx="1.5" className="stroke-muted-foreground" strokeWidth="1.3" />
      <rect x="56" y="44" width="22" height="10" rx="1.5" className="stroke-muted-foreground" strokeWidth="1.3" />
    </svg>
  );
}
