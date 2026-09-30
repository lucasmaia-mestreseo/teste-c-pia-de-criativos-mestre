import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowRight, Check, Download, Trash2, Layers, ImagePlus, Loader2, Wand2 } from 'lucide-react';
import { invalidateCreatives, reviewCreative, runWithConcurrency, transformCreative, type CreativeReview } from '@/lib/creativeOps';
import { bannerLabel, pixelsLabel } from '@/lib/creativeNames';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { formatName } from '@/lib/formatNames';
import { toast } from 'sonner';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { usePermissions } from '@/hooks/usePermissions';
import { toSignedUrls } from '@/lib/storageUrl';
import CreativeInsights, { ReviewBadge } from '@/components/CreativeInsights';
import { useCreativeDownload } from '@/hooks/useCreativeDownload';

type CreativeRow = NonNullable<ReturnType<typeof useGeneratedCreatives>['data']>[number];

interface UnfoldResultsPanelProps {
  projectId: string;
  /** Formats being generated right now (placeholders in their shape). */
  pending?: string[];
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}


export default function UnfoldResultsPanel({ projectId, pending = [], onUseAsReference }: UnfoldResultsPanelProps) {
  const { downloadOne, downloadMany } = useCreativeDownload(projectId);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const { can } = usePermissions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Group Desdobramento results by their key visual (newest group first).
  const groups = useMemo(() => {
    const map = new Map<string, CreativeRow[]>();
    for (const c of creatives || []) {
      if (c.kind !== 'unfold') continue;
      const key = c.source_image_url || c.parent_creative_id || c.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // tall → wide, the order people read formats in
    const ratio = (f: string) => { const [w, h] = f.split(':').map(Number); return w && h ? w / h : 1; };
    return Array.from(map.entries()).map(([source, items]) => ({ source, items: [...items].sort((a, b) => ratio(a.format) - ratio(b.format)) }));
  }, [creatives]);

  // Source URLs are stored in public format; sign them for display.
  const sourceKeys = groups.map((g) => g.source);
  const { data: signedSources } = useQuery({
    queryKey: ['unfold-sources', sourceKeys],
    enabled: sourceKeys.length > 0,
    queryFn: () => toSignedUrls(sourceKeys),
  });

  const allItems = groups.flatMap((g) => g.items);
  const openCreative = allItems.find((c) => c.id === openId) ?? (creatives || []).find((c) => c.id === openId) ?? null;

  /* ─── Corrigir: the corrected version (kind "fix", child of the piece) takes its place ─── */
  const qc = useQueryClient();
  const [fixing, setFixing] = useState<Set<string>>(new Set());
  const latestFix = useMemo(() => {
    const m = new Map<string, CreativeRow>();
    for (const c of creatives || []) {
      if (c.kind !== 'fix' || !c.parent_creative_id) continue;
      const prev = m.get(c.parent_creative_id);
      if (!prev || prev.created_at < c.created_at) m.set(c.parent_creative_id, c);
    }
    return m;
  }, [creatives]);
  /** Follows fix → fix of the fix… to the newest version of a piece. */
  const current = (c: CreativeRow): CreativeRow => {
    let cur = c;
    for (let i = 0; i < 5 && latestFix.has(cur.id); i++) cur = latestFix.get(cur.id)!;
    return cur;
  };
  const hasIssues = (c: CreativeRow) => c.review_status === 'issues' && !!(c.review as unknown as CreativeReview | null)?.issues?.length;

  const fixAll = async (items: CreativeRow[]) => {
    const targets = items.map(current).filter(hasIssues).filter((c) => !fixing.has(c.id));
    if (!targets.length) return;
    setFixing((f) => new Set([...f, ...targets.map((t) => t.id)]));
    const settled = await runWithConcurrency(targets, 3, async (c) => {
      try {
        const review = c.review as unknown as CreativeReview;
        const r = await transformCreative({
          projectId, operation: 'fix', creativeId: c.id,
          issues: review.issues.map((i) => i.fix_instruction || i.description),
          includeLogo: review.issues.some((i) => i.category === 'logo'),
        });
        invalidateCreatives(qc, projectId);
        void reviewCreative(qc, projectId, r.creativeId);
        return r;
      } finally {
        setFixing((f) => { const n = new Set(f); n.delete(c.id); return n; });
      }
    });
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    if (ok) toast.success(`${ok} versão(ões) corrigida(s)`, { description: 'As corrigidas passam pela revisão de novo.' });
    if (ok < settled.length) toast.error(`${settled.length - ok} correção(ões) falharam`);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-5">
      {groups.length === 0 && pending.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={Layers} title="Os formatos aparecem aqui">
            Escolha a peça-mãe à esquerda e marque os formatos. Cada versão chega ao lado da peça de origem, já revisada pela IA.
          </EmptyState>
        </div>
      )}

      {pending.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <p className="text-xs font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Desdobrando {pending.length} formato{pending.length > 1 ? 's' : ''}…
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            {pending.map((fmt, i) => (
              <div key={`${fmt}-${i}`} className="flex flex-col items-center gap-1.5">
                <div className="generating-pulse rounded-lg bg-secondary h-44" style={{ aspectRatio: fmt.replace(':', ' / ') }} />
                <span className="text-[10px] font-semibold text-muted-foreground">{formatName(fmt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((g, gi) => (
        <section key={g.source} className="rounded-2xl border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{g.items.length} formato{g.items.length > 1 ? 's' : ''} a partir da peça-mãe</p>
              <p className="text-[11px] text-muted-foreground">{new Date(g.items[0].created_at).toLocaleString('pt-BR')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {(() => {
                const pendingFix = g.items.map(current).filter(hasIssues);
                const fixedCount = g.items.filter((c) => current(c) !== c).length;
                const busy = g.items.some((c) => fixing.has(current(c).id));
                return (
                  <>
                    {(pendingFix.length > 0 || fixedCount > 0) && (
                      <span className="text-[11px] text-muted-foreground">
                        {pendingFix.length > 0 && <><b className="text-amber-500">{pendingFix.length}</b> com problemas</>}
                        {pendingFix.length > 0 && fixedCount > 0 && ' · '}
                        {fixedCount > 0 && <><b className="text-emerald-500">{fixedCount}</b> corrigida(s)</>}
                      </span>
                    )}
                    {(pendingFix.length > 0 || busy) && can('generate_creative') && (
                      <Button size="sm" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => fixAll(g.items)}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        {busy ? 'Corrigindo…' : `Corrigir todos (${pendingFix.length})`}
                      </Button>
                    )}
                  </>
                );
              })()}
              {can('download_creative') && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => downloadMany(g.items.map(current))}>
                  <Download className="h-3.5 w-3.5" /> Baixar todos
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-4 items-end overflow-x-auto no-scrollbar pb-1">
            {/^(https?|data):/.test(signedSources?.[gi] ?? '') && (
              <>
                <div className="flex flex-col items-center gap-1.5 flex-none">
                  <div className="rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 h-44 flex items-center checkerboard">
                    <img src={signedSources[gi]} alt="Peça-mãe" className="h-full w-auto object-contain" />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Peça-mãe</span>
                </div>
                <ArrowRight className="h-5 w-5 text-primary flex-none self-center mb-5" />
              </>
            )}
            {g.items.map((orig) => {
              const c = current(orig);
              const fixed = c !== orig;
              const busy = fixing.has(c.id);
              return (
              <button key={orig.id} onClick={() => setOpenId(c.id)} className="group flex flex-col items-center gap-1.5 flex-none">
                <div className={cn('relative rounded-lg overflow-hidden border bg-secondary h-44 flex items-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:border-primary/40', busy && 'generating-pulse')}>
                  <img src={c.image_url} alt={c.format} className="h-full w-auto object-contain" />
                  {!busy && <ReviewBadge creative={c} />}
                  {fixed && <span className="absolute bottom-1 left-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 flex items-center gap-0.5"><Check className="h-2.5 w-2.5" strokeWidth={3} /> Corrigido</span>}
                  {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></span>}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                  {bannerLabel((c as { banner_number?: number | null }).banner_number) ? `${bannerLabel((c as { banner_number?: number | null }).banner_number)} · ` : ''}{pixelsLabel(c.format) || formatName(c.format)}
                </span>
              </button>
              );
            })}
          </div>
        </section>
      ))}

      <Dialog open={!!openCreative} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-6xl w-[96vw] p-0 gap-0 overflow-hidden grid-cols-1">
          {openCreative && (
            <div className="flex flex-col md:flex-row items-stretch max-h-[92vh] min-h-0">
              <img src={openCreative.image_url} alt={openCreative.prompt || 'Criativo'} className="min-w-0 flex-1 max-h-[80vh] md:max-h-[88vh] object-contain self-center p-3" />
              <div className="flex flex-col gap-2 w-full md:w-[340px] flex-none min-w-0 border-t md:border-t-0 md:border-l bg-card/60 p-4 pt-12 max-h-[88vh] overflow-y-auto overflow-x-hidden">
                {can('download_creative') && (
                  <Button size="sm" variant="outline" onClick={() => downloadOne(openCreative)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                )}
                {onUseAsReference && (
                  <Button size="sm" variant="outline" onClick={() => { onUseAsReference(openCreative.image_url, openCreative.project_id); setOpenId(null); }}>
                    <ImagePlus className="h-3.5 w-3.5 mr-1" /> Referência
                  </Button>
                )}
                {can('delete_creative') && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(openCreative.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                )}
                <CreativeInsights creative={openCreative} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formato</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta versão? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteCreative.mutate({ id: deleteTarget, projectId });
                if (openId === deleteTarget) setOpenId(null);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
