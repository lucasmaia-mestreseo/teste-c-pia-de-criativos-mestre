import { useCallback, useRef, useState } from 'react';
import { useSwipeFiles, useUploadSwipeFile, useDeleteSwipeFile } from '@/hooks/useSwipeFiles';
import { Upload, Trash2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

interface SwipeFilePanelProps {
  projectId: string | null;
  selectedSwipe: Tables<'swipe_files'> | null;
  onSelectSwipe: (s: Tables<'swipe_files'>) => void;
}

export default function SwipeFilePanel({ projectId, selectedSwipe, onSelectSwipe }: SwipeFilePanelProps) {
  const { data: files, isLoading } = useSwipeFiles(projectId);
  const upload = useUploadSwipeFile();
  const deleteFile = useDeleteSwipeFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (!projectId) return;
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        await upload.mutateAsync({ projectId, file });
        toast.success(`${file.name} enviado`);
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
  }, [projectId, upload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
        <ImageIcon className="h-12 w-12" />
        <p className="text-sm text-center">Selecione ou crie um projeto para começar</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Swipe File</h2>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div className={cn(
        "flex-1 overflow-y-auto p-2 transition-colors",
        dragging && "bg-primary/5 ring-2 ring-inset ring-primary/30"
      )}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-secondary rounded animate-pulse" />
            ))}
          </div>
        ) : files?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
            <Upload className="h-8 w-8" />
            <p className="text-xs text-center">Arraste imagens aqui ou clique em Upload</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {files?.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "group relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all",
                  selectedSwipe?.id === f.id
                    ? "border-primary shadow-[0_0_12px_hsl(58_100%_67.5%/0.3)]"
                    : "border-transparent hover:border-border"
                )}
                onClick={() => onSelectSwipe(f)}
              >
                <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile.mutate({ id: f.id, projectId: f.project_id });
                  }}
                  className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/80 to-transparent p-1.5">
                  <p className="text-[10px] truncate text-foreground/80">{f.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
