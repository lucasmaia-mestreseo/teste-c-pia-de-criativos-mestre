import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Layers, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useGeneratedCreatives } from '@/hooks/useGeneratedCreatives';
import { FormatPicker } from '@/components/ResizeDialog';
import { useFormatOptions } from '@/hooks/useCreativeFormats';
import { invalidateCreatives, reviewCreative, runWithConcurrency, transformCreative } from '@/lib/creativeOps';

/** The key visual the other formats are derived from. */
type Source =
  | { type: 'upload'; storageUrl: string; previewUrl: string; format: string | null }
  | { type: 'creative'; creativeId: string; previewUrl: string; format: string };

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

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

interface UnfoldPanelProps {
  projectId: string;
  /** Number of formats still being generated (used for placeholders on the results side). */
  onPendingChange?: (pending: number) => void;
}

export default function UnfoldPanel({ projectId, onPendingChange }: UnfoldPanelProps) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const options = useFormatOptions();
  const { data: creatives } = useGeneratedCreatives(projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const running = !!progress;

  useEffect(() => {
    onPendingChange?.(progress ? progress.total - progress.done : 0);
  }, [progress, onPendingChange]);
  const recent = (creatives || []).slice(0, 12);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP)');
      return;
    }
    setUploading(true);
    try {
      const { width, height } = await readImageSize(file);
      const ext = file.name.split('.').pop() || 'png';
      const path = `${projectId}/sources/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('generated-creatives').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('generated-creatives').getPublicUrl(path);
      const format = nearestFormat(width, height, options);
      setSource({ type: 'upload', storageUrl: publicUrl, previewUrl: URL.createObjectURL(file), format });
      setSelected(options.filter((f) => f !== format));
    } catch (e) {
      toast.error('Erro ao enviar a imagem', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const pickCreative = (c: { id: string; image_url: string; format: string }) => {
    setSource({ type: 'creative', creativeId: c.id, previewUrl: c.image_url, format: c.format });
    setSelected(options.filter((f) => f !== c.format));
  };

  const handleRun = async () => {
    if (!source || !selected.length) return;
    const targets = [...selected];
    setProgress({ done: 0, total: targets.length });

    const settled = await runWithConcurrency(targets, 2, async (targetFormat) => {
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
        return r;
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    });

    setProgress(null);
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const failed = settled.length - ok;
    if (ok) toast.success(`Desdobramento pronto: ${ok} formato${ok > 1 ? 's' : ''}`);
    if (failed) {
      const err = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      toast.error(`${failed} formato(s) falharam`, { description: err?.reason?.message });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Desdobramento</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Suba uma peça-mãe (key visual) e gere a mesma peça em todos os formatos, com textos, logo e pessoas preservados.
        </p>
      </div>

      {/* 1. Peça-mãe */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">1. Peça-mãe</p>
        {source ? (
          <div className="relative w-fit">
            <img src={source.previewUrl} alt="Peça-mãe" className="max-h-48 max-w-full rounded-md border object-contain bg-secondary" />
            <button
              onClick={() => { setSource(null); setSelected([]); }}
              disabled={running}
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background shadow"
              title="Trocar peça"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] text-muted-foreground mt-1">
              {source.format ? <>Formato detectado: <strong>{source.format}</strong></> : 'Proporção fora dos formatos cadastrados'}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              disabled={uploading}
              className="w-full h-28 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {uploading ? 'Enviando…' : 'Clique ou arraste a peça aqui'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            {recent.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">ou escolha um criativo do projeto:</p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCreative(c)}
                      className="w-12 h-12 rounded border overflow-hidden bg-secondary hover:ring-2 hover:ring-primary/60"
                      title={c.format}
                    >
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Formatos */}
      <div className={cn('space-y-2', !source && 'opacity-50 pointer-events-none')}>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">2. Formatos de saída</p>
        <FormatPicker options={options} selected={selected} onChange={setSelected} disabledFormat={source?.format} />
      </div>

      {/* 3. Ajustes */}
      <div className={cn('space-y-2', !source && 'opacity-50 pointer-events-none')}>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">3. Ajustes (opcional)</p>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Ex.: no 9:16, subir a headline; no 16:9, pessoa à esquerda"
          className="min-h-[60px] text-xs bg-secondary resize-none"
          disabled={running}
        />
      </div>

      {progress && (
        <div className="space-y-1">
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">{progress.done} de {progress.total} formatos prontos — cada um leva cerca de 30 a 90 segundos.</p>
        </div>
      )}

      <Button onClick={handleRun} disabled={!source || !selected.length || running || !can('generate_creative')} className="h-8 text-xs">
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Layers className="h-3.5 w-3.5 mr-1" />}
        {selected.length ? `Desdobrar em ${selected.length} formato${selected.length > 1 ? 's' : ''}` : 'Escolha os formatos'}
      </Button>
    </div>
  );
}
