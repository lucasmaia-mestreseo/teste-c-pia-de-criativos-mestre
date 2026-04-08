import { useState, useEffect, useCallback } from 'react';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Download, Trash2, Star, Minimize2, Maximize2, Eye, Loader2, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);

  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();

  const dynamicCreatives = (creatives || []).filter((c: any) =>
    /^\[(conservative|innovative|radical)\]/.test(c.prompt)
  );

  const modalCreative = selectedIndex !== null ? dynamicCreatives[selectedIndex] : null;

  const handlePrev = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev < dynamicCreatives.length - 1 ? prev + 1 : prev);
  }, [dynamicCreatives.length]);

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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
          Resultados ({dynamicCreatives.length})
        </h3>
        <div className="flex items-center gap-1.5">
          <Minimize2 className="h-3 w-3 text-muted-foreground" />
          <Slider value={[thumbSize]} onValueChange={handleThumbSizeChange} min={48} max={800} step={8} className="w-20" />
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {generating && (
          <div className="generating-pulse rounded-md bg-secondary flex-shrink-0 flex items-center justify-center border" style={{ width: thumbSize, height: thumbSize }}>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {dynamicCreatives.map((c: any, idx: number) => (
          <div key={c.id} className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0" style={{ width: thumbSize, height: thumbSize }}>
            <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 py-1">
              <button onClick={() => setSelectedIndex(idx)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Detalhes">
                <Eye className="h-3 w-3 text-muted-foreground" />
              </button>
              <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !c.favorite })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Favoritar">
                <Star className={`h-3 w-3 ${c.favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
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
        {dynamicCreatives.length === 0 && !generating && (
          <p className="text-sm text-muted-foreground px-1">Nenhum criativo dinâmico gerado ainda.</p>
        )}
      </div>

      {/* Detail Modal with Navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalCreative && (
            <div className="flex gap-4 items-center">
              <button onClick={handlePrev} disabled={selectedIndex === 0} className="p-2 rounded-full hover:bg-secondary disabled:opacity-20 disabled:cursor-default transition-colors flex-shrink-0">
                <ChevronLeft className="h-6 w-6 text-foreground" />
              </button>
              <img src={modalCreative.image_url} alt={modalCreative.prompt} className="max-h-[80vh] max-w-[65vw] object-contain rounded-md" />
              <button onClick={handleNext} disabled={selectedIndex === dynamicCreatives.length - 1} className="p-2 rounded-full hover:bg-secondary disabled:opacity-20 disabled:cursor-default transition-colors flex-shrink-0">
                <ChevronRight className="h-6 w-6 text-foreground" />
              </button>
              <div className="flex flex-col gap-2 min-w-[180px] max-w-[220px] pt-8 max-h-[80vh] overflow-y-auto">
                <Button size="sm" variant="outline" onClick={() => handleDownload(modalCreative.image_url, `creative-${modalCreative.id}.png`)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant={modalCreative.favorite ? 'default' : 'outline'}
                  onClick={() => {
                    toggleFavorite.mutate({ id: modalCreative.id, projectId: modalCreative.project_id, favorite: !modalCreative.favorite });
                  }}
                >
                  <Star className={`h-3.5 w-3.5 mr-1 ${modalCreative.favorite ? 'fill-primary-foreground' : ''}`} />
                  {modalCreative.favorite ? 'Favoritado' : 'Favoritar'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalCreative.id, projectId: modalCreative.project_id })}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                {onUseAsReference && (
                  <Button size="sm" variant="outline" onClick={() => { onUseAsReference(modalCreative.image_url, modalCreative.project_id); setSelectedIndex(null); }}>
                    <ImagePlus className="h-3.5 w-3.5 mr-1" /> Referência
                  </Button>
                )}
                <ExpandablePrompt text={modalCreative.prompt} />
                <p className="text-[10px] text-muted-foreground"><strong>Formato:</strong> {modalCreative.format}</p>
                <p className="text-[10px] text-muted-foreground">{(selectedIndex ?? 0) + 1} / {dynamicCreatives.length}</p>
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
