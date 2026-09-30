import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelectedById } from '@/hooks/useSelectedById';
import { collapseOptions } from '@/lib/creativeOptions';
import { OptionsBadge, OptionsStrip } from '@/components/CreativeOptions';
import ExpandablePrompt from '@/components/ExpandablePrompt';
import EmptyState from '@/components/EmptyState';
import CreativeInsights, { ReviewBadge } from '@/components/CreativeInsights';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Download, Trash2, Star, Minimize2, Maximize2, Eye, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreativeDownload } from '@/hooks/useCreativeDownload';

interface CreativesPanelProps {
  projectId: string | null;
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}

const STORAGE_KEY = 'thumbSize-creatives';

export default function CreativesPanel({ projectId, onUseAsReference }: CreativesPanelProps) {
  const { downloadOne, downloadMany } = useCreativeDownload(projectId);
  const { can } = usePermissions();
  const [thumbSize, setThumbSize] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 200);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();

  // Opções (2x/4x): one thumbnail per piece; the viewer compares Opção A/B/C/D.
  const { primaries, optionsOf } = useMemo(() => collapseOptions(creatives || []), [creatives]);
  const byId = useMemo(() => new Map((creatives || []).map((c) => [c.id, c])), [creatives]);
  const filtered = onlyFavorites
    ? primaries.filter((c: any) => optionsOf(c).some((t: any) => t.favorite))
    : primaries;

  const [selectedIndex, setSelectedIndex, selectedId, setSelectedId] = useSelectedById(filtered, (item, id) => optionsOf(item).some((t) => t.id === id));
  const modalPrimary = selectedIndex !== null ? filtered[selectedIndex] : null;
  const modalCreative = modalPrimary ? (byId.get(selectedId ?? '') ?? modalPrimary) : null;

  const handlePrev = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIndex(prev => prev !== null && prev < filtered.length - 1 ? prev + 1 : prev);
  }, [filtered.length]);

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

  const handleDownload = async (url: string, name: string, creativeId?: string) => {
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
      if (creativeId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('user_downloads' as any).insert({ user_id: user.id, creative_id: creativeId });
        }
      }
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
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Criativos ({filtered.length})</h2>
        <div className="flex items-center gap-3">
          <Button
            variant={onlyFavorites ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
          >
            <Star className={`h-3 w-3 ${onlyFavorites ? 'fill-primary-foreground' : ''}`} />
            Favoritos
          </Button>
          <div className="flex items-center gap-1.5">
            <Minimize2 className="h-3 w-3 text-muted-foreground" />
            <Slider value={[thumbSize]} onValueChange={handleThumbSizeChange} min={48} max={800} step={8} className="w-20" />
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4">
        {filtered.length === 0 && (
          <div className="w-full">
            <EmptyState icon={onlyFavorites ? Star : ImagePlus} title={onlyFavorites ? 'Nenhum favorito ainda' : 'A galeria está vazia'}>
              {onlyFavorites
                ? 'Marque com a estrela os criativos aprovados pelo cliente — ou a variação vencedora de um teste A/B.'
                : 'Os criativos gerados em Gerar, Dinâmica e Desdobramento aparecem aqui.'}
            </EmptyState>
          </div>
        )}
        {filtered.map((c: any, idx: number) => (
          <div key={c.id} className="creative-thumb group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0" style={{ width: thumbSize, height: thumbSize, animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
            <img src={c.image_url} alt={c.prompt} loading="lazy" className="thumb-img" />
                  {thumbSize >= 96 && <span className="thumb-format">{c.format}</span>}
            <ReviewBadge creative={c} />
            <OptionsBadge count={optionsOf(c).length} />
            <div className="thumb-actions absolute bottom-0 left-0 right-0 bg-background/85 flex items-center justify-center gap-0.5 py-1">
              <button onClick={() => setSelectedIndex(idx)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Detalhes">
                <Eye className="h-3 w-3 text-muted-foreground" />
              </button>
              {can('favorite_creative') && (
                <button onClick={() => toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !c.favorite })} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Favoritar">
                  <Star className={`h-3 w-3 ${c.favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </button>
              )}
              {can('download_creative') && (
                <button onClick={() => downloadOne(c)} className="p-1 rounded hover:bg-secondary hover:border-primary/50 border border-transparent transition-colors" title="Download">
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

      {/* Detail Modal with Navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-6xl w-[96vw] p-0 gap-0 overflow-hidden grid-cols-1">
          {modalCreative && (
            <div className="flex flex-col md:flex-row items-stretch max-h-[92vh] min-h-0">
              {/* Left arrow */}
              <button
                onClick={handlePrev}
                disabled={selectedIndex === 0}
                className="hidden md:block self-center p-2 mx-1 rounded-full hover:bg-secondary disabled:opacity-20 disabled:cursor-default transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-6 w-6 text-foreground" />
              </button>

              <img src={modalCreative.image_url} alt={modalCreative.prompt || 'Criativo'} className="min-w-0 flex-1 max-h-[80vh] md:max-h-[88vh] object-contain self-center p-3" />

              {/* Right arrow */}
              <button
                onClick={handleNext}
                disabled={selectedIndex === filtered.length - 1}
                className="hidden md:block self-center p-2 mx-1 rounded-full hover:bg-secondary disabled:opacity-20 disabled:cursor-default transition-colors flex-shrink-0"
              >
                <ChevronRight className="h-6 w-6 text-foreground" />
              </button>

              <div className="flex flex-col gap-2 w-full md:w-[340px] flex-none min-w-0 border-t md:border-t-0 md:border-l bg-card/60 p-4 pt-12 max-h-[88vh] overflow-y-auto overflow-x-hidden">
                {can('download_creative') && (
                  <Button size="sm" variant="outline" onClick={() => downloadOne(modalCreative)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                )}
                {can('favorite_creative') && (
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
                {modalPrimary && <OptionsStrip projectId={modalPrimary.project_id} takes={optionsOf(modalPrimary)} viewingId={modalCreative!.id} onView={setSelectedId} />}
                <CreativeInsights creative={modalCreative} />
                <ExpandablePrompt text={modalCreative.prompt} />
                <p className="text-[10px] text-muted-foreground">{(selectedIndex ?? 0) + 1} / {filtered.length}</p>
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
