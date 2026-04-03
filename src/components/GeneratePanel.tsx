import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Download, Trash2, Loader2, Maximize2, Minimize2, Star, Eye, ImagePlus } from 'lucide-react';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';

const STORAGE_KEY = 'thumbSize-generate';

interface GeneratePanelProps {
  projectId: string | null;
  generating?: boolean;
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}

export default function GeneratePanel({ projectId, generating, onUseAsReference }: GeneratePanelProps) {
  const [thumbSize, setThumbSize] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 160);
  const [modalImage, setModalImage] = useState<{ url: string; prompt: string; id: string; projectId: string; favorite: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();

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
      if (modalImage?.id === deleteTarget.id) setModalImage(null);
      setDeleteTarget(null);
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {(creatives && creatives.length > 0 || generating) && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Resultados</h3>
              <div className="flex items-center gap-1.5">
                <Minimize2 className="h-3 w-3 text-muted-foreground" />
                <Slider value={[thumbSize]} onValueChange={handleThumbSizeChange} min={48} max={640} step={8} className="w-16" />
                <Maximize2 className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {generating && (
                <div className="generating-pulse rounded-md bg-secondary flex-shrink-0 flex items-center justify-center border" style={{ width: thumbSize, height: thumbSize }}>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {creatives?.map((c) => (
                <div key={c.id} className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0" style={{ width: thumbSize, height: thumbSize }}>
                  <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 py-1">
                    <button onClick={() => setModalImage({ url: c.image_url, prompt: c.prompt, id: c.id, projectId: c.project_id, favorite: (c as any).favorite })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Detalhes">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !(c as any).favorite })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Favoritar">
                      <Star className={`h-3 w-3 ${(c as any).favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    </button>
                    <button onClick={() => handleDownload(c.image_url, `creative-${c.id}.png`)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Download">
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => setDeleteTarget({ id: c.id, projectId: c.project_id })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Excluir">
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {onUseAsReference && (
                      <button onClick={() => onUseAsReference(c.image_url, c.project_id)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Usar como referência">
                        <ImagePlus className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <Dialog open={!!modalImage} onOpenChange={() => setModalImage(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalImage && (
            <div className="flex gap-4 items-start">
              <img src={modalImage.url} alt={modalImage.prompt} className="max-h-[80vh] max-w-[70vw] object-contain rounded-md" />
              <div className="flex flex-col gap-2 min-w-[120px] pt-8">
                <Button size="sm" variant="outline" onClick={() => handleDownload(modalImage.url, `creative-${modalImage.id}.png`)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button size="sm" variant={modalImage.favorite ? 'default' : 'outline'} onClick={() => {
                  toggleFavorite.mutate({ id: modalImage.id, projectId: modalImage.projectId, favorite: !modalImage.favorite });
                  setModalImage({ ...modalImage, favorite: !modalImage.favorite });
                }}>
                  <Star className={`h-3.5 w-3.5 mr-1 ${modalImage.favorite ? 'fill-primary-foreground' : ''}`} />
                  {modalImage.favorite ? 'Favoritado' : 'Favoritar'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalImage.id, projectId: modalImage.projectId })}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                {onUseAsReference && (
                  <Button size="sm" variant="outline" onClick={() => { onUseAsReference(modalImage.url, modalImage.projectId); setModalImage(null); }}>
                    <ImagePlus className="h-3.5 w-3.5 mr-1" /> Referência
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalImage.prompt}</p>
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
