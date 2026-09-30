import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Layers2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { chooseOption, optionLetter, optionMeta, OPTION_CHOICES, readOptionCount, writeOptionCount, type OptionCount } from '@/lib/creativeOptions';

interface Take { id: string; image_url: string; created_at?: string; generation_meta?: unknown; project_id?: string }

/** Small "2 opções" badge for gallery thumbnails. */
export function OptionsBadge({ count, className }: { count: number; className?: string }) {
  if (count < 2) return null;
  return (
    <span className={cn('absolute bottom-1 right-1 rounded-full bg-background/85 backdrop-blur text-[9px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 shadow', className)} title={`${count} opções — abra para comparar`}>
      <Layers2 className="h-2.5 w-2.5 text-primary" /> {count}
    </span>
  );
}

/** In the viewer: Opção A / B / C / D, view any of them and choose the one that counts. */
export function OptionsStrip({ projectId, takes, viewingId, onView, imageOf, className }: {
  projectId: string; takes: Take[]; viewingId: string; onView: (id: string) => void;
  /** Image shown for a take (e.g. its corrected version). */
  imageOf?: (t: Take) => string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  if (takes.length < 2) return null;
  const chosen = takes.find((t) => optionMeta(t).chosen) ?? takes[0];
  const choose = async () => {
    setSaving(true);
    try {
      await chooseOption(qc, projectId, takes, viewingId);
      toast.success(`Opção ${optionLetter(takes.findIndex((t) => t.id === viewingId))} escolhida`, { description: 'É ela que aparece na galeria, no download e no Corrigir todos.' });
    } catch (e) {
      toast.error('Não foi possível escolher a opção', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={cn("rounded-xl border bg-background/40 p-2.5 space-y-2", className)}>
      <p className="text-[11px] font-semibold">Opções desta peça</p>
      <div className="grid grid-cols-4 gap-1.5">
        {takes.map((t, i) => (
          <button key={t.id} onClick={() => onView(t.id)} title={`Opção ${optionLetter(i)}`}
            className={cn('relative aspect-square rounded-md overflow-hidden border-2 bg-secondary transition-all', t.id === viewingId ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}>
            <img src={imageOf ? imageOf(t) : t.image_url} alt="" className="w-full h-full object-cover" />
            <span className="absolute top-0.5 left-0.5 rounded bg-background/85 text-[9px] font-bold px-1">{optionLetter(i)}</span>
            {t.id === chosen.id && <span className="absolute bottom-0.5 right-0.5 rounded-full bg-primary text-primary-foreground p-0.5"><Check className="h-2 w-2" strokeWidth={4} /></span>}
          </button>
        ))}
      </div>
      {viewingId === chosen.id ? (
        <p className="text-[10.5px] text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Esta é a opção escolhida</p>
      ) : (
        <button onClick={choose} disabled={saving}
          className="w-full rounded-md bg-primary text-primary-foreground text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Usar a opção {optionLetter(takes.findIndex((t) => t.id === viewingId))}
        </button>
      )}
    </div>
  );
}

/** "Gerar 1x / 2x (recomendado) / 4x" picker, used by Gerar and Desdobramento. */
export function OptionCountPicker({ value, onChange, disabled, compact }: { value: OptionCount; onChange: (n: OptionCount) => void; disabled?: boolean; compact?: boolean }) {
  const current = OPTION_CHOICES.find((o) => o.n === value)!;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1">
        {OPTION_CHOICES.map((o) => (
          <button key={o.n} type="button" disabled={disabled} onClick={() => onChange(o.n)}
            className={cn('rounded-md py-1 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1',
              value === o.n ? (o.warn ? 'bg-amber-500 text-black' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:text-foreground')}>
            {o.warn && <AlertTriangle className="h-3 w-3" />}{o.label}{o.recommended && !compact ? <span className="opacity-70 font-normal"> · rec.</span> : null}
          </button>
        ))}
      </div>
      <p className={cn('text-[10px]', current.warn ? 'text-amber-500 font-semibold' : 'text-muted-foreground')}>
        {current.warn ? 'ALERTA: alto consumo de créditos — 4 gerações por peça.' : current.hint}
      </p>
    </div>
  );
}

/** Option count remembered per tool. */
export function useOptionCount(where: string) {
  const [n, setN] = useState<OptionCount>(() => readOptionCount(where));
  const set = (v: OptionCount) => { setN(v); writeOptionCount(where, v); };
  return [n, set] as const;
}
