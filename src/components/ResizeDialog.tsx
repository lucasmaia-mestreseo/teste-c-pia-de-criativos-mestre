import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loader2, Scaling } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFormatOptions } from '@/hooks/useCreativeFormats';
import { invalidateCreatives, reviewCreative, runWithConcurrency, transformCreative } from '@/lib/creativeOps';

/** Small proportional box so people see the shape of each format. */
function FormatShape({ format }: { format: string }) {
  const [w, h] = format.split(':').map(Number);
  const ratio = w && h ? w / h : 1;
  const max = 22;
  const width = ratio >= 1 ? max : Math.round(max * ratio);
  const height = ratio >= 1 ? Math.round(max / ratio) : max;
  return <span className="inline-block rounded-[2px] border-2 border-current" style={{ width, height }} />;
}

/** Multi-select of creative formats (used by Redimensionar and Desdobramento). */
export function FormatPicker({
  options,
  selected,
  onChange,
  disabledFormat,
}: {
  options: string[];
  selected: string[];
  onChange: (formats: string[]) => void;
  disabledFormat?: string | null;
}) {
  const toggle = (f: string) =>
    onChange(selected.includes(f) ? selected.filter((x) => x !== f) : [...selected, f]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((f) => {
        const isCurrent = f === disabledFormat;
        const active = selected.includes(f);
        return (
          <button
            key={f}
            type="button"
            disabled={isCurrent}
            onClick={() => toggle(f)}
            title={isCurrent ? 'Formato atual' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-md border text-[11px] font-medium transition-colors',
              active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-primary/50',
              isCurrent && 'opacity-40 cursor-not-allowed',
            )}
          >
            <FormatShape format={f} />
            {f}
          </button>
        );
      })}
    </div>
  );
}

interface ResizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creative: { id: string; project_id: string; image_url: string; format: string };
}

export default function ResizeDialog({ open, onOpenChange, creative }: ResizeDialogProps) {
  const qc = useQueryClient();
  const options = useFormatOptions();
  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setInstructions('');
    }
  }, [open, creative.id]);

  const running = !!progress;

  const handleRun = async () => {
    if (!selected.length) return;
    const targets = [...selected];
    setProgress({ done: 0, total: targets.length });
    const settled = await runWithConcurrency(targets, 2, async (targetFormat) => {
      try {
        const r = await transformCreative({
          projectId: creative.project_id,
          operation: 'resize',
          creativeId: creative.id,
          targetFormat,
          instructions: instructions.trim() || undefined,
        });
        invalidateCreatives(qc, creative.project_id);
        void reviewCreative(qc, creative.project_id, r.creativeId);
        return r;
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    });
    setProgress(null);

    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const failed = settled.length - ok;
    if (ok) toast.success(`${ok} formato${ok > 1 ? 's' : ''} gerado${ok > 1 ? 's' : ''}`, { description: 'As novas versões estão na galeria do projeto.' });
    if (failed) {
      const err = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      toast.error(`${failed} formato(s) falharam`, { description: err?.reason?.message });
    }
    if (!failed) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scaling className="h-4 w-4" /> Redimensionar criativo</DialogTitle>
          <DialogDescription>
            A IA recompõe a mesma peça em outros formatos, mantendo textos, logo, pessoas e cores. Cada formato vira um novo criativo na galeria.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 items-start">
          <img src={creative.image_url} alt="" className="w-20 h-20 object-contain rounded border bg-secondary flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <p className="text-[11px] text-muted-foreground">Formato atual: <strong>{creative.format}</strong>. Escolha os novos:</p>
            <FormatPicker options={options} selected={selected} onChange={setSelected} disabledFormat={creative.format} />
          </div>
        </div>

        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Ajustes opcionais (ex.: no 16:9, pessoa à esquerda e textos à direita)"
          className="min-h-[60px] text-xs bg-secondary resize-none"
          disabled={running}
        />

        {progress && (
          <div className="space-y-1">
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">{progress.done} de {progress.total} formatos prontos…</p>
          </div>
        )}

        <Button onClick={handleRun} disabled={!selected.length || running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Scaling className="h-4 w-4 mr-1" />}
          {selected.length ? `Gerar ${selected.length} formato${selected.length > 1 ? 's' : ''}` : 'Selecione os formatos'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
