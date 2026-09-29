import { useState, useEffect, useCallback } from 'react';
import ExpandablePrompt from '@/components/ExpandablePrompt';
import CreativeInsights, { ReviewBadge } from '@/components/CreativeInsights';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Download, Trash2, Loader2, Maximize2, Minimize2, Star, Eye, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();
  const { can } = usePermissions();

  const items = creatives || [];
  const modalCreative = selectedIndex !== null ? items[selectedIndex] : null;

  const handlePrev = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev < items.length - 1 ? prev + 1 : prev);
  }, [items.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, handlePrev, handleNext]);

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
      if (modalCreative?.id === deleteTarget.id) setSelectedIndex(null);
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
        {(items.length > 0 || generating) && (
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
              {items.map((c, idx) => (
                <div key={c.id} className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0" style={{ width: thumbSize, height: thumbSize }}>
                  <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
                  <ReviewBadge creative={c} />
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 py-1">
                    <button onClick={() => setSelectedIndex(idx)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Detalhes">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {can('favorite_creative') && (
                      <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !(c as any).favorite })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Favoritar">
                        <Star className={`h-3 w-3 ${(c as any).favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                      </button>
                    )}
                    {can('download_creative') && (
                      <button onClick={() => handleDownload(c.image_url, `creative-${c.id}.png`)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Download">
                        <Download className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    {can('delete_creative') && (
                      <button onClick={() => setDeleteTarget({ id: c.id, projectId: c.project_id })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Excluir">
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
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

      {/* Image Modal with Navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-5xl w-auto p-6">
          {modalCreative && (
            <div className="flex gap-6 items-start">
              <div className="relative flex-shrink-0">
                <img src={modalCreative.image_url} alt={modalCreative.prompt} className="max-h-[80vh] max-w-[65vw] object-contain rounded-md block" />
                <button
                  onClick={handlePrev}
                  disabled={selectedIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/60 hover:bg-background/80 backdrop-blur-sm shadow-md disabled:opacity-0 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedIndex === items.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/60 hover:bg-background/80 backdrop-blur-sm shadow-md disabled:opacity-0 disabled:pointer-events-none transition-all"
                >
                  <ChevronRight className="h-5 w-5 text-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-2 min-w-[200px] max-w-[220px] pr-6 max-h-[80vh] overflow-y-auto self-start">
                {can('download_creative') && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(modalCreative.image_url, `creative-${modalCreative.id}.png`)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                )}
                {can('favorite_creative') && (
                  <Button size="sm" variant={(modalCreative as any).favorite ? 'default' : 'outline'} onClick={() => {
                    toggleFavorite.mutate({ id: modalCreative.id, projectId: modalCreative.project_id, favorite: !(modalCreative as any).favorite });
                  }}>
                    <Star className={`h-3.5 w-3.5 mr-1 ${(modalCreative as any).favorite ? 'fill-primary-foreground' : ''}`} />
                    {(modalCreative as any).favorite ? 'Favoritado' : 'Favoritar'}
                  </Button>
                )}
                {can('delete_creative') && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalCreative.id, projectId: modalCreative.project_id })}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                )}
                {onUseAsReference && (
                  <Button size="sm" variant="outline" onClick={() => { onUseAsReference(modalCreative.image_url, modalCreative.project_id); setSelectedIndex(null); }}>
                    <ImagePlus className="h-3.5 w-3.5 mr-1" /> Referência
                  </Button>
                )}
                <CreativeInsights creative={modalCreative} />
                <p className="text-[10px] text-muted-foreground mt-2">{(selectedIndex ?? 0) + 1} / {items.length}</p>
                <ExpandablePrompt text={modalCreative.prompt} />
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
