import { useState, useCallback, useEffect } from 'react';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { Download, Trash2, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface HistoryPanelProps {
  projectId: string | null;
}

export default function HistoryPanel({ projectId }: HistoryPanelProps) {
  const { data: creatives, isLoading } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);

  const items = creatives ?? [];
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

  const handleDownload = async (url: string, id: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const clean = stripPngMetadata(new Uint8Array(buf));
      const blob = new Blob([clean.buffer as ArrayBuffer], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `creative-${id}.png`;
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
        <p className="text-sm">Selecione um projeto</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clock className="h-4 w-4" /> Histórico
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Nenhum criativo gerado ainda</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((c, idx) => (
            <div key={c.id} className="flex gap-3 p-4 hover:bg-secondary/50 transition-colors">
              <img
                src={c.image_url}
                alt={c.prompt}
                className="w-20 h-20 object-cover rounded border flex-shrink-0 cursor-pointer"
                onClick={() => setSelectedIndex(idx)}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm line-clamp-2">{c.prompt}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-secondary px-1.5 py-0.5 rounded text-primary text-[10px] font-medium">{c.format}</span>
                  <span>{format(new Date(c.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleDownload(c.image_url, c.id)}
                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                >
                  <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: c.id, projectId: c.project_id })}
                  className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal with Navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalCreative && (
            <div className="flex gap-4 items-start">
              <div className="relative flex items-center">
                <button
                  onClick={handlePrev}
                  disabled={selectedIndex === 0}
                  className="absolute -left-10 z-10 p-1 rounded-full bg-background/80 border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <img src={modalCreative.image_url} alt={modalCreative.prompt || 'Criativo'} className="max-h-[80vh] max-w-[70vw] object-contain rounded-md" />
                <button
                  onClick={handleNext}
                  disabled={selectedIndex === items.length - 1}
                  className="absolute -right-10 z-10 p-1 rounded-full bg-background/80 border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2 min-w-[120px] pt-8">
                <span className="text-xs text-muted-foreground text-center">{(selectedIndex ?? 0) + 1} / {items.length}</span>
                <Button size="sm" variant="outline" onClick={() => handleDownload(modalCreative.image_url, modalCreative.id)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ id: modalCreative.id, projectId: modalCreative.project_id })}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                {modalCreative.prompt && <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalCreative.prompt}</p>}
                <p className="text-[10px] text-muted-foreground"><strong>Formato:</strong> {modalCreative.format}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(modalCreative.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
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
