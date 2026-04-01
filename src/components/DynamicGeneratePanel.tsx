import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, Sparkles, ShieldCheck, Lightbulb, Rocket, Star, Minimize2, Maximize2, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGeneratedCreatives, useDeleteCreative, useToggleFavorite } from '@/hooks/useGeneratedCreatives';
import { stripPngMetadata } from '@/lib/stripPngMetadata';
import { useQueryClient } from '@tanstack/react-query';

interface DynamicGeneratePanelProps {
  projectId: string | null;
}

const FORMATS = ['9:16', '4:5', '1:1', '16:9'] as const;

const TYPE_CONFIG = [
  {
    id: 'conservative' as const,
    label: 'Conservadores',
    description: 'Linguagem direta, provas sociais, benefícios concretos',
    icon: ShieldCheck,
    color: 'text-blue-400',
  },
  {
    id: 'innovative' as const,
    label: 'Inovadores',
    description: 'Abordagens novas, metáforas visuais, storytelling incomum',
    icon: Lightbulb,
    color: 'text-amber-400',
  },
  {
    id: 'radical' as const,
    label: 'Fora da Caixa',
    description: 'Disruptivos, virais, provocativos, não convencionais',
    icon: Rocket,
    color: 'text-rose-400',
  },
];

export default function DynamicGeneratePanel({ projectId }: DynamicGeneratePanelProps) {
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({
    conservative: 2,
    innovative: 2,
    radical: 1,
  });
  const [format, setFormat] = useState<string>('1:1');
  const [generating, setGenerating] = useState(false);
  const [thumbSize, setThumbSize] = useState(100);
  const [modalCreative, setModalCreative] = useState<any | null>(null);

  const { data: creatives } = useGeneratedCreatives(projectId);
  const deleteCreative = useDeleteCreative();
  const toggleFavorite = useToggleFavorite();
  const qc = useQueryClient();

  // Filter creatives that were generated dynamically (prompt starts with [conservative], [innovative], [radical])
  const dynamicCreatives = (creatives || []).filter((c: any) =>
    /^\[(conservative|innovative|radical)\]/.test(c.prompt)
  );

  const toggleType = (id: string) => {
    setSelectedTypes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const anySelected = Object.values(selectedTypes).some(Boolean);

  const handleGenerate = async () => {
    if (!projectId || !anySelected) return;
    setGenerating(true);

    const types = Object.entries(selectedTypes)
      .filter(([, v]) => v)
      .map(([type]) => ({ type, count: counts[type] || 1 }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-dynamic-creative', {
        body: { projectId, types, format },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.results?.length || 0} criativos gerados!`);
      qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar criativos');
    } finally {
      setGenerating(false);
    }
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

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    conservative: 'Conservador',
    innovative: 'Inovador',
    radical: 'Fora da Caixa',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Results grid (top, scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {(dynamicCreatives.length > 0 || generating) && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                Resultados ({dynamicCreatives.length})
              </h3>
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
            <div className="flex flex-wrap gap-2 px-3 pb-2">
              {generating && (
                <div
                  className="generating-pulse rounded-md bg-secondary flex-shrink-0 flex items-center justify-center border"
                  style={{ width: thumbSize, height: thumbSize }}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {dynamicCreatives.map((c: any) => (
                <div
                  key={c.id}
                  className="group relative rounded-md overflow-hidden border bg-secondary flex-shrink-0 cursor-pointer"
                  style={{ width: thumbSize, height: thumbSize }}
                  onClick={() => setModalCreative(c)}
                >
                  <img src={c.image_url} alt={c.prompt} className="w-full h-full object-cover" />
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
          </div>
        )}
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
              <div className="flex flex-col gap-2 min-w-[160px] pt-8">
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

      {/* Config area (bottom) */}
      <div className="px-3 pb-3 pt-2 border-t space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Geração Dinâmica</h2>
        </div>

        <div className="space-y-2">
          {TYPE_CONFIG.map(({ id, label, description, icon: Icon, color }) => (
            <div key={id} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
              <Checkbox
                checked={!!selectedTypes[id]}
                onCheckedChange={() => toggleType(id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                {selectedTypes[id] && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                      <span className="text-[10px] font-semibold">{counts[id]}</span>
                    </div>
                    <Slider
                      value={[counts[id]]}
                      onValueChange={([v]) => setCounts(prev => ({ ...prev, [id]: v }))}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-[80px] bg-secondary h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGenerate}
            disabled={generating || !anySelected}
            className="flex-1 h-8 text-xs"
          >
            {generating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Gerando...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar Criativos</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
