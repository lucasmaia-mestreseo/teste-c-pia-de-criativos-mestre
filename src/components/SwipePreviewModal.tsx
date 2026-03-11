import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useSwipeAnalysis } from '@/hooks/useSwipeAnalysis';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Type, ImageIcon, Stamp } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface SwipePreviewModalProps {
  file: Tables<'swipe_files'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SwipePreviewModal({ file, open, onOpenChange }: SwipePreviewModalProps) {
  const { analysis, isPending } = useSwipeAnalysis(file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 gap-0 flex flex-row overflow-hidden">
        <DialogTitle className="sr-only">Preview do Swipe File</DialogTitle>

        {/* Left: Image */}
        <div className="flex-[3] bg-secondary/30 flex items-center justify-center p-4 min-w-0">
          {file && (
            <img
              src={file.image_url}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded"
            />
          )}
        </div>

        {/* Right: Detected elements */}
        <div className="flex-[2] border-l flex flex-col min-w-0">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Elementos Detectados
            </h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !analysis ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum elemento detectado
                </p>
              ) : (
                <>
                  {/* Texts */}
                  {analysis.texts?.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <Type className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Textos</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{analysis.texts.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {analysis.texts.map((t) => (
                          <div key={t.id} className="rounded border bg-secondary/40 px-3 py-2">
                            <p className="text-sm">{t.content}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">{t.role}</Badge>
                              <Badge variant="outline" className="text-[10px]">{t.position}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Logos */}
                  {analysis.logos?.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <Stamp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Logos</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{analysis.logos.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {analysis.logos.map((l) => (
                          <div key={l.id} className="rounded border bg-secondary/40 px-3 py-2">
                            <p className="text-sm">{l.description}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{l.position}</Badge>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Photos */}
                  {analysis.photos?.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Fotos</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{analysis.photos.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {analysis.photos.map((p) => (
                          <div key={p.id} className="rounded border bg-secondary/40 px-3 py-2">
                            <p className="text-sm">{p.description}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{p.position}</Badge>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
