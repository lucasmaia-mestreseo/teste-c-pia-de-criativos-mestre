import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowRight, Download, Trash2, Layers, ImagePlus } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { formatName } from '@/lib/formatNames';
import { toast } from 'sonner';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { usePermissions } from '@/hooks/usePermissions';
import { toSignedUrls } from '@/lib/storageUrl';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import CreativeInsights, { ReviewBadge } from '@/components/CreativeInsights';

type CreativeRow = NonNullable<ReturnType<typeof useGeneratedCreatives>['data']>[number];

interface UnfoldResultsPanelProps {
  projectId: string;
  /** Formats being generated right now (placeholders in their shape). */
  pending?: string[];
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}

async function downloadImage(url: string, name: string) {
  const res = await fetch(url);
  const clean = stripPngMetadata(new Uint8Array(await res.arrayBuffer()));
  const blob = new Blob([clean.buffer as ArrayBuffer], { type: 'image/png' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const fileSafe = (format: string) => format.replace(':', 'x');

export default function UnfoldResultsPanel({ projectId, pending = [], onUseAsReference }: UnfoldResultsPanelProps) {
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
  const openCreative = allItems.find((c) => c.id === openId) ?? null;

  const downloadGroup = async (items: CreativeRow[]) => {
    try {
      for (const c of items) {
        await downloadImage(c.image_url, `desdobramento-${fileSafe(c.format)}-${c.id.slice(0, 6)}.png`);
      }
    } catch {
      toast.error('Erro no download');
    }
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
            {can('download_creative') && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => downloadGroup(g.items)}>
                <Download className="h-3.5 w-3.5" /> Baixar todos
              </Button>
            )}
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
            {g.items.map((c) => (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="group flex flex-col items-center gap-1.5 flex-none">
                <div className="relative rounded-lg overflow-hidden border bg-secondary h-44 flex items-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:border-primary/40">
                  <img src={c.image_url} alt={c.format} className="h-full w-auto object-contain" />
                  <ReviewBadge creative={c} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">{formatName(c.format)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={!!openCreative} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-5xl w-auto p-6">
          {openCreative && (
            <div className="flex gap-6 items-start">
              <img src={openCreative.image_url} alt="" className="max-h-[80vh] max-w-[60vw] object-contain rounded-md" />
              <div className="flex flex-col gap-2 min-w-[200px] max-w-[220px] pr-6 max-h-[80vh] overflow-y-auto">
                {can('download_creative') && (
                  <Button size="sm" variant="outline" onClick={() => downloadImage(openCreative.image_url, `desdobramento-${fileSafe(openCreative.format)}.png`).catch(() => toast.error('Erro no download'))}>
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
