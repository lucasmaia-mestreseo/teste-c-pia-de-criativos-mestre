import { useState } from 'react';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Download, Trash2, Star, Minimize2, Maximize2, Filter } from 'lucide-react';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { toast } from 'sonner';

interface CreativesPanelProps {
  projectId: string | null;
}

export default function CreativesPanel({ projectId }: CreativesPanelProps) {
  const [thumbSize, setThumbSize] = useState(100);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [modalCreative, setModalCreative] = useState<any | null>(null);
  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();

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

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  const filtered = onlyFavorites
    ? (creatives || []).filter((c: any) => c.favorite)
    : (creatives || []);

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
            <Slider
              value={[thumbSize]}
              onValueChange={([v]) => setThumbSize(v)}
              min={48}
              max={200}
              step={8}
              className="w-20"
            />
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {onlyFavorites ? 'Nenhum favorito encontrado.' : 'Nenhum criativo gerado ainda.'}
          </p>
        )}
        {filtered.map((c: any) => (
          <div
            key={c.id}
            className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0 cursor-pointer"
            style={{ width: thumbSize, height: thumbSize }}
            onClick={() => setModalCreative(c)}
          >
            <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
            {/* Favorite star */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite.mutate({ id: c.id, projectId: c.project_id, favorite: !c.favorite });
              }}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-background/60 hover:bg-background/80 transition-colors"
            >
              <Star className={`h-3.5 w-3.5 ${c.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
            <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(c.image_url, `creative-${c.id}.png`); }}
                className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCreative.mutate({ id: c.id, projectId: c.project_id }); }}
                className="p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!modalCreative} onOpenChange={() => setModalCreative(null)}>
        <DialogContent className="max-w-[90vw] w-auto p-3">
          {modalCreative && (
            <div className="flex gap-4 items-start">
              <img
                src={modalCreative.image_url}
                alt={modalCreative.prompt}
                className="max-h-[80vh] max-w-[70vw] object-contain rounded-md"
              />
              <div className="flex flex-col gap-2 min-w-[120px] pt-8">
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
                <Button size="sm" variant="destructive" onClick={() => { deleteCreative.mutate({ id: modalCreative.id, projectId: modalCreative.project_id }); setModalCreative(null); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{modalCreative.prompt}</p>
                <p className="text-[10px] text-muted-foreground"><strong>Formato:</strong> {modalCreative.format}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
