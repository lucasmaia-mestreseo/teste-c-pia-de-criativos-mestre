import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { Download, Trash2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryPanelProps {
  projectId: string | null;
}

export default function HistoryPanel({ projectId }: HistoryPanelProps) {
  const { data: creatives, isLoading } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();

  const handleDownload = async (url: string, id: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const clean = stripPngMetadata(new Uint8Array(buf));
      const blob = new Blob([clean], { type: 'image/png' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `creative-${id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Erro no download');
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

      {creatives?.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Nenhum criativo gerado ainda</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {creatives?.map((c) => (
            <div key={c.id} className="flex gap-3 p-4 hover:bg-secondary/50 transition-colors">
              <img
                src={c.image_url}
                alt={c.prompt}
                className="w-20 h-20 object-cover rounded border flex-shrink-0"
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
                  onClick={() => deleteCreative.mutate({ id: c.id, projectId: c.project_id })}
                  className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
