import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertTriangle, RefreshCw, Wand2, Scaling, CircleHelp, PenLine, FlaskConical, Columns3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  KIND_LABELS,
  formatUsd,
  originOf,
  reviewCreative,
  transformCreative,
  invalidateCreatives,
  type CreativeReview,
} from '@/lib/creativeOps';
import ResizeDialog from '@/components/ResizeDialog';
import AdCopyDialog from '@/components/AdCopyDialog';
import VariantsDialog, { CompareVariantsDialog } from '@/components/VariantsDialog';
import { useGeneratedCreatives } from '@/hooks/useGeneratedCreatives';

/** Minimal shape shared by every panel that lists generated_creatives rows. */
export interface CreativeLike {
  id: string;
  project_id: string;
  image_url: string;
  format: string;
  kind?: string | null;
  model_used?: string | null;
  cost_usd?: number | null;
  review?: unknown;
  review_status?: string | null;
  generation_meta?: unknown;
  parent_creative_id?: string | null;
}

const SEVERITY_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const SEVERITY_STYLE: Record<string, string> = {
  alta: 'text-destructive',
  media: 'text-amber-500',
  baixa: 'text-muted-foreground',
};

/** Small status dot for thumbnails. */
export function ReviewBadge({ creative, className }: { creative: CreativeLike; className?: string }) {
  const status = creative.review_status;
  if (!status) return null;
  const review = creative.review as CreativeReview | null;
  const map: Record<string, { icon: React.ReactNode; title: string; bg: string }> = {
    pending: { icon: <Loader2 className="h-3 w-3 animate-spin" />, title: 'Revisando...', bg: 'bg-background/80 text-muted-foreground' },
    approved: { icon: <ShieldCheck className="h-3 w-3" />, title: `Aprovado na revisão${review ? ` (${review.score})` : ''}`, bg: 'bg-emerald-600 text-white' },
    issues: { icon: <AlertTriangle className="h-3 w-3" />, title: `${review?.issues?.length ?? ''} problema(s) na revisão`, bg: 'bg-amber-500 text-white' },
    error: { icon: <CircleHelp className="h-3 w-3" />, title: 'Revisão indisponível', bg: 'bg-background/80 text-muted-foreground' },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span title={cfg.title} className={cn('absolute top-1 right-1 rounded-full p-1 shadow', cfg.bg, className)}>
      {cfg.icon}
    </span>
  );
}

/**
 * Detail block for the creative modal: origin, model, cost, automatic review
 * (with "Corrigir" / "Revisar") and the "Redimensionar" action.
 */
export default function CreativeInsights({ creative }: { creative: CreativeLike }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [reviewing, setReviewing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const { data: all } = useGeneratedCreatives(creative.project_id);
  const variantCount = (all ?? []).filter((c) => (c as CreativeLike).parent_creative_id === creative.id && originOf(c as CreativeLike) === 'variant').length;
  const hasCopy = !!(creative.generation_meta as { adCopy?: unknown } | null)?.adCopy;
  const origin = originOf(creative);

  const review = creative.review as CreativeReview | null;
  const status = reviewing ? 'pending' : creative.review_status;
  const canGenerate = can('generate_creative');

  const handleReview = async () => {
    setReviewing(true);
    const r = await reviewCreative(qc, creative.project_id, creative.id);
    setReviewing(false);
    if (!r) toast.error('Não foi possível revisar agora. Tente novamente em instantes.');
  };

  const handleFix = async () => {
    if (!review?.issues?.length) return;
    setFixing(true);
    try {
      const result = await transformCreative({
        projectId: creative.project_id,
        operation: 'fix',
        creativeId: creative.id,
        issues: review.issues.map((i) => i.fix_instruction || i.description),
        includeLogo: review.issues.some((i) => i.category === 'logo'),
      });
      toast.success('Versão corrigida criada', { description: 'Ela aparece na galeria e também passa pela revisão.' });
      invalidateCreatives(qc, creative.project_id);
      void reviewCreative(qc, creative.project_id, result.creativeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao corrigir criativo');
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-2 mt-1">
      {canGenerate && (
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setResizeOpen(true)} className="col-span-2">
            <Scaling className="h-3.5 w-3.5 mr-1" /> Redimensionar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)} className="text-[11px] px-2">
            <PenLine className="h-3.5 w-3.5 mr-1" /> {hasCopy ? 'Ver copy' : 'Copy'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)} className="text-[11px] px-2">
            <FlaskConical className="h-3.5 w-3.5 mr-1" /> Variações
          </Button>
          {variantCount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setCompareOpen(true)} className="col-span-2 text-[11px]">
              <Columns3 className="h-3.5 w-3.5 mr-1" /> Comparar A/B ({variantCount + 1})
            </Button>
          )}
        </div>
      )}

      {/* Revisão automática */}
      <div className="rounded-md border p-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Revisão</span>
          {status === 'pending' && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> revisando…</span>}
          {status === 'approved' && <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Aprovado · {review?.score}</span>}
          {status === 'issues' && <span className="text-[10px] font-medium text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {review?.issues.length} problema(s) · {review?.score}</span>}
          {status === 'error' && <span className="text-[10px] text-muted-foreground">indisponível</span>}
          {!status && <span className="text-[10px] text-muted-foreground">não revisado</span>}
        </div>

        {review?.summary && status !== 'pending' && (
          <p className="text-[10px] text-muted-foreground leading-snug">{review.summary}</p>
        )}

        {status !== 'pending' && review?.issues?.length ? (
          <ul className="space-y-1">
            {review.issues.map((issue, i) => (
              <li key={i} className="text-[10px] leading-snug">
                <span className={cn('font-semibold', SEVERITY_STYLE[issue.severity])}>{SEVERITY_LABEL[issue.severity] ?? issue.severity}</span>
                <span className="text-muted-foreground"> · {issue.category}: </span>
                {issue.description}
              </li>
            ))}
          </ul>
        ) : null}

        {canGenerate && (
          <div className="flex gap-1.5 pt-0.5">
            {status === 'issues' && (
              <Button size="sm" className="h-7 text-[11px] flex-1" onClick={handleFix} disabled={fixing}>
                {fixing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                Corrigir
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-[11px] flex-1" onClick={handleReview} disabled={status === 'pending' || fixing}>
              <RefreshCw className="h-3 w-3 mr-1" /> {status ? 'Revisar de novo' : 'Revisar'}
            </Button>
          </div>
        )}
      </div>

      {/* Origem e custo */}
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p><strong>Formato:</strong> {creative.format}</p>
        {creative.kind && <p><strong>Origem:</strong> {KIND_LABELS[origin] ?? origin}</p>}
        {creative.model_used && <p className="break-all"><strong>Modelo:</strong> {creative.model_used}</p>}
        {creative.cost_usd !== null && creative.cost_usd !== undefined && <p><strong>Custo:</strong> {formatUsd(creative.cost_usd)}</p>}
      </div>

      <ResizeDialog open={resizeOpen} onOpenChange={setResizeOpen} creative={creative} />
      <AdCopyDialog open={copyOpen} onOpenChange={setCopyOpen} creative={creative} />
      <VariantsDialog open={variantsOpen} onOpenChange={setVariantsOpen} creative={creative} />
      <CompareVariantsDialog open={compareOpen} onOpenChange={setCompareOpen} creative={creative} />
    </div>
  );
}
