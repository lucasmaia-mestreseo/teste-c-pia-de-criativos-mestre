import { useState, useCallback, useEffect } from 'react';
import ExpandablePrompt from '@/components/ExpandablePrompt';
import CountUp from '@/components/CountUp';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Zap, TrendingUp, Image, FolderOpen, Download, Trash2, Star, Eye, Minimize2, Maximize2, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';

interface DashboardPanelProps {
  onSelectProject: (id: string) => void;
  onUseAsReference?: (imageUrl: string, projectId?: string) => void;
}

const STORAGE_KEY = 'thumbSize-dashboard';

export default function DashboardPanel({ onSelectProject, onUseAsReference }: DashboardPanelProps) {
  const { total, last7Days, recentCreatives, recentProjects, isLoading } = useDashboardStats();
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();
  const { can } = usePermissions();
  const [thumbSize, setThumbSize] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 160);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; projectId: string } | null>(null);

  const items = recentCreatives as any[];
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

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-8 overflow-y-auto h-full space-y-8">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary fill-primary" />
          Dashboard
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua atividade criativa</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 stagger">
        <Card className="card-hover relative overflow-hidden bg-gradient-to-br from-card to-secondary/40 border-border">
          <div aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Image className="h-4 w-4" />
              Total de Criativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary"><CountUp value={total ?? 0} /></p>
          </CardContent>
        </Card>
        <Card className="card-hover relative overflow-hidden bg-gradient-to-br from-card to-secondary/40 border-border">
          <div aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary"><CountUp value={last7Days ?? 0} /></p>
          </CardContent>
        </Card>
      </div>

      {/* Recent creatives */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Últimos criativos gerados</h3>
          <div className="flex items-center gap-1.5">
            <Minimize2 className="h-3 w-3 text-muted-foreground" />
            <Slider
              value={[thumbSize]}
              onValueChange={handleThumbSizeChange}
              min={48}
              max={640}
              step={8}
              className="w-20"
            />
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum criativo gerado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {items.map((c: any, idx: number) => (
              <div
                key={c.id}
                className="creative-thumb group relative rounded-lg overflow-hidden border border-border bg-secondary"
                style={{ width: thumbSize, height: thumbSize, animationDelay: `${Math.min(idx, 12) * 25}ms` }}
              >
                <img
                  src={c.image_url}
                  alt="Criativo"
                  className="thumb-img cursor-pointer"
                  loading="lazy"
                  onClick={() => setSelectedIndex(idx)}
                />
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
        )}
      </div>

      {/* Recent projects */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Projetos com criativos
        </h3>
        {recentProjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum projeto com criativos ainda.</p>
        ) : (
          <div className="space-y-2 stagger">
            {recentProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="group w-full flex items-center justify-between p-3 rounded-lg border border-transparent bg-secondary hover:border-primary/40 hover:text-primary hover:translate-x-0.5 transition-all duration-200 text-left"
              >
                <span className="font-medium text-sm">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(p.lastGenerated), { addSuffix: true, locale: ptBR })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal with Navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalCreative && (
            <div className="flex gap-4 items-start">
              <button
                onClick={handlePrev}
                disabled={selectedIndex === 0}
                className="flex-shrink-0 self-center p-2 rounded-full border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <img src={modalCreative.image_url} alt={modalCreative.prompt || 'Criativo'} className="max-h-[80vh] max-w-[65vw] object-contain rounded-md" />
              <button
                onClick={handleNext}
                disabled={selectedIndex === items.length - 1}
                className="flex-shrink-0 self-center p-2 rounded-full border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="flex flex-col gap-2 min-w-[180px] max-w-[220px] pt-8 max-h-[80vh] overflow-y-auto">
                <span className="text-xs text-muted-foreground text-center">{(selectedIndex ?? 0) + 1} / {items.length}</span>
                {can('download_creative') && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(modalCreative.image_url, `creative-${modalCreative.id}.png`)}>
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
                {modalCreative.prompt && <ExpandablePrompt text={modalCreative.prompt} />}
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
