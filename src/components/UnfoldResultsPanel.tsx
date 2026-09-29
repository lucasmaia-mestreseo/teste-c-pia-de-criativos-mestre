import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, Loader2, Trash2, Layers, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { usePermissions } from '@/hooks/usePermissions';
import { toSignedUrls } from '@/lib/storageUrl';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import CreativeInsights, { ReviewBadge } from '@/components/CreativeInsights';

type CreativeRow = NonNullable<ReturnType<typeof useGeneratedCreatives>['data']>[number];

interface UnfoldResultsPanelProps {
  projectId: string;
  pending?: number;
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

export default function UnfoldResultsPanel({ projectId, pending = 0, onUseAsReference }: UnfoldResultsPanelProps) {
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
    return Array.from(map.entries()).map(([source, items]) => ({ source, items }));
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
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-5">
      {pending > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Gerando {pending} formato{pending > 1 ? 's' : ''}…
        </div>
      )}

      {groups.length === 0 && pending === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
          <Layers className="h-8 w-8 opacity-40" />
          <p className="text-sm">Nenhum desdobramento ainda.</p>
          <p className="text-xs max-w-xs">Suba uma peça-mãe à esquerda e escolha os formatos. As versões aparecem aqui, agrupadas pela peça de origem.</p>
        </div>
      )}

      {groups.map((g, gi) => (
        <section key={g.source} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/^(https?|data):/.test(signedSources?.[gi] ?? '') && (
                <img src={signedSources[gi]} alt="Peça-mãe" className="h-10 w-10 rounded border object-contain bg-secondary" />
              )}
              <div>
                <p className="text-xs font-semibold">Peça-mãe</p>
                <p className="text-[10px] text-muted-foreground">
                  {g.items.length} formato{g.items.length > 1 ? 's' : ''} · {new Date(g.items[0].created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            {can('download_creative') && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => downloadGroup(g.items)}>
                <Download className="h-3 w-3 mr-1" /> Baixar todos
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {g.items.map((c) => (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="group flex flex-col items-center gap-1">
                <div className="relative rounded-md overflow-hidden border bg-secondary h-40 flex items-center">
                  <img src={c.image_url} alt={c.format} className="h-full w-auto object-contain group-hover:opacity-90" />
                  <ReviewBadge creative={c} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{c.format}</span>
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
