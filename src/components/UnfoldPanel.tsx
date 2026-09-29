import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronDown, ImageUp, Layers, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useGeneratedCreatives } from '@/hooks/useGeneratedCreatives';
import { useFormatOptions } from '@/hooks/useCreativeFormats';
import { invalidateCreatives, reviewCreative, runWithConcurrency, transformCreative } from '@/lib/creativeOps';

/** The key visual the other formats are derived from. */
type Source =
  | { type: 'upload'; storageUrl: string; previewUrl: string; format: string | null; width: number; height: number }
  | { type: 'creative'; creativeId: string; previewUrl: string; format: string; width: number; height: number };

type Status = 'queued' | 'running' | 'done' | 'error';

/** Closest known format to the image's proportions (null if nothing is close). */
function nearestFormat(width: number, height: number, options: string[]): string | null {
  const ratio = width / height;
  let best: { f: string; diff: number } | null = null;
  for (const f of options) {
    const [w, h] = f.split(':').map(Number);
    if (!w || !h) continue;
    const diff = Math.abs(Math.log(ratio / (w / h)));
    if (!best || diff < best.diff) best = { f, diff };
  }
  return best && best.diff < 0.08 ? best.f : null;
}

function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

const ratioOf = (f: string) => { const [w, h] = f.split(':').map(Number); return w && h ? w / h : 1; };

const FORMAT_HINTS: Record<string, string> = {
  '9:16': 'Stories e Reels',
  '4:5': 'Feed vertical',
  '1:1': 'Feed quadrado',
  '16:9': 'Display e YouTube',
  '1.91:1': 'Link e LinkedIn',
  '3:4': 'Pinterest',
};

const TIPS = ['No 9:16, subir a headline', 'No 16:9, pessoa à esquerda', 'Manter o CTA grande', 'Logo sempre no topo'];

interface UnfoldPanelProps {
  projectId: string;
  /** Formats still being generated (the results side shows placeholders in their shape). */
  onPendingChange?: (formats: string[]) => void;
}

export default function UnfoldPanel({ projectId, onPendingChange }: UnfoldPanelProps) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const options = useFormatOptions();
  const { data: creatives } = useGeneratedCreatives(projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});

  const running = Object.values(status).some((s) => s === 'queued' || s === 'running');
  const pending = Object.entries(status).filter(([, s]) => s === 'queued' || s === 'running').map(([f]) => f);
  const pendingKey = pending.join(',');
  useEffect(() => { onPendingChange?.(pendingKey ? pendingKey.split(',') : []); }, [pendingKey, onPendingChange]);

  const recent = (creatives || []).filter((c) => c.kind !== 'unfold').slice(0, 16);
  const targets = options.filter((f) => f !== source?.format);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP)');
      return;
    }
    setUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      const { width, height } = await readImageSize(previewUrl);
      const ext = file.name.split('.').pop() || 'png';
      const path = `${projectId}/sources/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('generated-creatives').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('generated-creatives').getPublicUrl(path);
      const format = nearestFormat(width, height, options);
      setSource({ type: 'upload', storageUrl: publicUrl, previewUrl, format, width, height });
      setSelected(options.filter((f) => f !== format));
      setStatus({});
    } catch (e) {
      toast.error('Erro ao enviar a imagem', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const pickCreative = async (c: { id: string; image_url: string; format: string }) => {
    const size = await readImageSize(c.image_url).catch(() => ({ width: ratioOf(c.format) * 1000, height: 1000 }));
    setSource({ type: 'creative', creativeId: c.id, previewUrl: c.image_url, format: c.format, ...size });
    setSelected(options.filter((f) => f !== c.format));
    setStatus({});
  };

  const toggle = (f: string) => setSelected((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));
  const presets: { label: string; formats: string[] }[] = [
    { label: 'Todos', formats: targets },
    { label: 'Redes sociais', formats: targets.filter((f) => ratioOf(f) <= 1) },
    { label: 'Display', formats: targets.filter((f) => ratioOf(f) > 1) },
  ].filter((p) => p.formats.length);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  const handleRun = async () => {
    if (!source || !selected.length) return;
    const list = [...selected];
    setStatus(Object.fromEntries(list.map((f) => [f, 'queued' as Status])));

    const settled = await runWithConcurrency(list, 2, async (targetFormat) => {
      setStatus((s) => ({ ...s, [targetFormat]: 'running' }));
      try {
        const r = await transformCreative({
          projectId,
          operation: 'unfold',
          targetFormat,
          instructions: instructions.trim() || undefined,
          ...(source.type === 'upload'
            ? { sourceImageUrl: source.storageUrl, sourceFormat: source.format ?? undefined }
            : { creativeId: source.creativeId }),
        });
        invalidateCreatives(qc, projectId);
        void reviewCreative(qc, projectId, r.creativeId);
        setStatus((s) => ({ ...s, [targetFormat]: 'done' }));
        return r;
      } catch (e) {
        setStatus((s) => ({ ...s, [targetFormat]: 'error' }));
        throw e;
      }
    });

    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const failed = settled.length - ok;
    if (ok) toast.success(`Desdobramento pronto: ${ok} formato${ok > 1 ? 's' : ''}`, { description: 'As versões estão à direita, junto da peça-mãe.' });
    if (failed) {
      const err = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      toast.error(`${failed} formato(s) falharam`, { description: err?.reason?.message });
    }
    // let the ticks show for a moment, then the panel is ready for the next round
    setTimeout(() => setStatus({}), 3500);
  };

  const done = Object.values(status).filter((s) => s === 'done' || s === 'error').length;
  const total = Object.keys(status).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* header */}
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Layers className="h-4 w-4" /></span>
            <h2 className="text-sm font-bold">Desdobramento</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            Uma peça aprovada vira todos os formatos da campanha, com os mesmos textos, logo e pessoas — só a composição se adapta.
          </p>
        </div>

        {/* key visual */}
        <section className="space-y-2">
          <SectionLabel done={!!source}>Peça-mãe</SectionLabel>
          {source ? (
            <div className="rounded-xl border bg-secondary/40 p-3 flex gap-3 items-center animate-in fade-in zoom-in-95 duration-300">
              <div className="h-24 w-24 rounded-lg checkerboard flex items-center justify-center overflow-hidden flex-none">
                <img src={source.previewUrl} alt="Peça-mãe" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-xs font-semibold">{source.type === 'upload' ? 'Arquivo enviado' : 'Criativo do projeto'}</div>
                <div className="text-[11px] text-muted-foreground">
                  {source.format ? <>Formato <b className="text-foreground">{source.format}</b> · {source.width}×{source.height}px</> : <>{source.width}×{source.height}px · proporção livre</>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 -ml-2 text-[11px] gap-1" disabled={running}
                  onClick={() => { setSource(null); setSelected([]); setStatus({}); }}>
                  <RefreshCw className="h-3 w-3" /> Trocar peça
                </Button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                disabled={uploading}
                className={cn('w-full rounded-xl border-2 border-dashed px-4 py-5 flex items-center gap-4 text-left transition-all duration-300',
                  dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/50 hover:bg-secondary/40')}
              >
                <FanDiagram active={dragOver} />
                <span className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <ImageUp className="h-3.5 w-3.5 text-primary" />}
                    {uploading ? 'Enviando…' : dragOver ? 'Pode soltar' : 'Arraste a peça aprovada'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">ou clique para escolher · PNG, JPG ou WEBP</span>
                </span>
              </button>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {recent.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">ou parta de um criativo do projeto</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                    {recent.map((c) => (
                      <button key={c.id} onClick={() => pickCreative(c)} title={c.format}
                        className="group relative h-16 w-16 flex-none rounded-lg border overflow-hidden bg-secondary transition-all duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/60">
                        <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-semibold text-center py-px opacity-0 group-hover:opacity-100 transition-opacity">{c.format}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* formats, previewed with the key visual inside each frame */}
        <section className={cn('space-y-2.5 transition-opacity duration-300', !source && 'opacity-40 pointer-events-none')}>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel done={!!source && selected.length > 0}>Formatos</SectionLabel>
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
            {(source ? targets : options).map((f) => (
              <FormatCard key={f} format={f} image={source?.previewUrl} active={selected.includes(f)} status={status[f]}
                onClick={() => !running && toggle(f)} />
            ))}
          </div>
          {source?.format && <p className="text-[10px] text-muted-foreground">O formato da peça-mãe ({source.format}) já existe e fica de fora.</p>}
        </section>

        {/* adjustments */}
        <section className={cn('transition-opacity duration-300', !source && 'opacity-40 pointer-events-none')}>
          <button onClick={() => setAdjustOpen((v) => !v)} className="w-full flex items-center gap-2 text-left">
            <SectionLabel>Ajustes finos</SectionLabel>
            <span className="text-[10px] text-muted-foreground">opcional</span>
            {instructions.trim() && !adjustOpen && <span className="text-[10px] text-primary truncate">· {instructions.trim()}</span>}
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
          <div className="flex gap-1">
            {Object.entries(status).map(([f, s]) => (
              <div key={f} className="flex-1 space-y-1" title={f}>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700 ease-out',
                    s === 'done' ? 'w-full bg-primary' : s === 'error' ? 'w-full bg-destructive' : s === 'running' ? 'w-2/3 bg-primary/60 animate-pulse' : 'w-0')} />
                </div>
                <div className="text-[9px] text-center text-muted-foreground">{f}</div>
              </div>
            ))}
          </div>
        )}
        <Button onClick={handleRun} disabled={!source || !selected.length || running || !can('generate_creative')} className={cn('w-full h-10 gap-2 font-semibold', !running && source && selected.length > 0 && 'btn-shine')}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? `Desdobrando… ${done} de ${total}` : !source ? 'Escolha a peça-mãe' : selected.length ? `Desdobrar em ${selected.length} formato${selected.length > 1 ? 's' : ''}` : 'Escolha os formatos'}
        </Button>
        {running && <p className="text-[10px] text-center text-muted-foreground">Cada formato leva de 30 a 90 segundos. Pode continuar navegando.</p>}
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
function FormatCard({ format, image, active, status, onClick }: { format: string; image?: string; active: boolean; status?: Status; onClick: () => void }) {
  const r = ratioOf(format);
  const H = 76;
  const W = Math.min(120, Math.round(H * r));
  const h = r > 1 ? Math.round(W / r) : H;
  return (
    <button onClick={onClick}
      className={cn('group relative rounded-xl border p-2.5 flex flex-col items-center gap-2 transition-all duration-200',
        active ? 'border-primary/70 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]' : 'opacity-60 hover:opacity-100 hover:border-primary/40')}>
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
        <div className="text-[11px] font-bold">{format}</div>
        <div className="text-[9.5px] text-muted-foreground">{FORMAT_HINTS[format] ?? 'Formato personalizado'}</div>
      </div>
      <span className={cn('absolute top-1.5 right-1.5 h-4 w-4 rounded-full border flex items-center justify-center transition-all duration-200',
        active ? 'bg-primary border-primary text-primary-foreground scale-100' : 'scale-90 border-muted-foreground/40')}>
        {active && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
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
