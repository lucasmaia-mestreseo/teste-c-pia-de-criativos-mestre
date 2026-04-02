import { useState } from 'react';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Download, Trash2, Star, Minimize2, Maximize2, Eye, Loader2, ImagePlus } from 'lucide-react';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';

interface DynamicResultsPanelProps {
  projectId: string | null;
  generating?: boolean;
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}

const STORAGE_KEY = 'thumbSize-dynamic';

export default function DynamicResultsPanel({ projectId, generating, onUseAsReference }: DynamicResultsPanelProps) {
  const [thumbSize, setThumbSize] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 200);
  const [modalCreative, setModalCreative] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);

  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();

  const dynamicCreatives = (creatives || []).filter((c: any) =>
    /^\[(conservative|innovative|radical)\]/.test(c.prompt)
  );

  const handleThumbSizeChange = ([v]: number[]) => {
    setThumbSize(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const clean = stripPngMetadata(new Uint8Array(buf));
      const blob = new Blob([clean.buffer as ArrayBuffer], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Erro no download');
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteCreative.mutate(deleteTarget);
      if (modalCreative?.id === deleteTarget.id) setModalCreative(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
          Resultados ({dynamicCreatives.length})
        </h3>
        <div className="flex items-center gap-1.5">
          <Minimize2 className="h-3 w-3 text-muted-foreground" />
          <Slider
            value={[thumbSize]}
            onValueChange={handleThumbSizeChange}
            min={48}
            max={800}
            step={8}
            className="w-20"
          />
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {generating && (
          <div
            className="generating-pulse rounded-md bg-secondary flex-shrink-0 flex items-center justify-center border"
            style={{ width: thumbSize, height: thumbSize }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {dynamicCreatives.map((c: any) => (
          <div
            key={c.id}
            className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0"
            style={{ width: thumbSize, height: thumbSize }}
          >
            <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 py-1">
              <button onClick={() => setModalCreative(c)} className="p-1 rounded-full hover:bg-accent transition-colors" title="Detalhes">
                <Eye className="h-3 w-3 text-foreground" />
              </button>
              <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !c.favorite })} className="p-1 rounded-full hover:bg-accent transition-colors" title="Favoritar">
                <Star className={`h-3 w-3 ${c.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-foreground'}`} />
              </button>
              <button onClick={() => handleDownload(c.image_url, `creative-${c.id}.png`)} className="p-1 rounded-full hover:bg-accent transition-colors" title="Download">
                <Download className="h-3 w-3 text-foreground" />
              </button>
              <button onClick={() => setDeleteTarget({ id: c.id, projectId: c.project_id })} className="p-1 rounded-full hover:bg-accent transition-colors" title="Excluir">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        {dynamicCreatives.length === 0 && !generating && (
          <p className="text-sm text-muted-foreground px-1">Nenhum criativo dinâmico gerado ainda.</p>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!modalCreative} onOpenChange={() => setModalCreative(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalCreative && (
            <div className="flex gap-4 items-start">
              <img src={modalCreative.image_url} alt={modalCreative.prompt} className="max-h-[80vh] max-w-[70vw] object-contain rounded-md" />
              <div className="flex flex-col gap-2 min-w-[160px] pt-8">
                <Button size="sm" variant="outline" onClick={() => handleDownload(modalCreative.image_url, `creative-${modalCreative.id}.png`)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant={modalCreative.favorite ? 'default' : 'outline'}
                  onClick={() => {
                    toggleFavorite.mutate({ id: modalCreative.id, projectId: modalCreative.project_id, favorite: !modalCreative.favorite });
                    setModalCreative({ ...modalCreative, favorite: !modalCreative.favorite });
                  }}
                >
                  <Star className={`h-3.5 w-3.5 mr-1 ${modalCreative.favorite ? 'fill-primary-foreground' : ''}`} />
                  {modalCreative.favorite ? 'Favoritado' : 'Favoritar'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalCreative.id, projectId: modalCreative.project_id })}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalCreative.prompt}</p>
                <p className="text-[10px] text-muted-foreground"><strong>Formato:</strong> {modalCreative.format}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir criativo</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este criativo? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
