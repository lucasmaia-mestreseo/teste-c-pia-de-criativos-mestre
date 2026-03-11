import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageAttachmentsProps {
  projectId: string;
  images: string[];
  onChange: (images: string[]) => void;
}

export default function ImageAttachments({ projectId, images, onChange }: ImageAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const ext = file.name.split('.').pop();
        const path = `${projectId}/attachments/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('swipe-files').upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('swipe-files').getPublicUrl(path);
        newUrls.push(publicUrl);
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
    if (newUrls.length > 0) {
      onChange([...images, ...newUrls]);
    }
    setUploading(false);
  }, [projectId, images, onChange]);

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        Anexar imagens
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      {images.map((url, i) => (
        <div key={i} className="relative group w-8 h-8 rounded border overflow-hidden bg-secondary flex-shrink-0">
          <img src={url} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => removeImage(i)}
            className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
