import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useGeneratedCreatives, useDeleteCreative } from '@/hooks/useGeneratedCreatives';
import { useBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';

const FORMATS = ['9:16', '4:5', '1:1', '16:9'] as const;

interface GeneratePanelProps {
  projectId: string | null;
  selectedSwipe: Tables<'swipe_files'> | null;
}

export default function GeneratePanel({ projectId, selectedSwipe }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<string>('1:1');
  const [generating, setGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [includePersonPhoto, setIncludePersonPhoto] = useState(false);
  const [selectedPersonPhoto, setSelectedPersonPhoto] = useState<string>('');
  const { data: creatives } = useGeneratedCreatives(projectId);
  const { data: brandKit } = useBrandKit(projectId);
  const deleteCreative = useDeleteCreative();
  const qc = useQueryClient();

  const hasLogo = !!brandKit?.logo_url;
  const personPhotos = brandKit?.people_photos?.filter(Boolean) ?? [];
  const hasPersonPhotos = personPhotos.length > 0;

  const handleGenerate = async () => {
    if (!projectId || !selectedSwipe || !prompt.trim()) {
      toast.error('Selecione um criativo base e escreva um prompt');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          prompt: prompt.trim(),
          format,
          swipeFileId: selectedSwipe.id,
          swipeFileUrl: selectedSwipe.image_url,
          projectId,
          brandKit: brandKit ? {
            primaryColor: brandKit.primary_color,
            secondaryColor: brandKit.secondary_color,
            backgroundColor: brandKit.background_color,
            auxColors: brandKit.aux_colors,
            typography: brandKit.typography,
            logoUrl: includeLogo && hasLogo ? brandKit.logo_url : null,
            personPhotoUrl: includePersonPhoto && selectedPersonPhoto ? selectedPersonPhoto : null,
          } : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Criativo gerado com sucesso!');
      qc.invalidateQueries({ queryKey: ['generated_creatives', projectId] });
      setPrompt('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar criativo');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
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

  return (
    <div className="flex flex-col h-full">
      {selectedSwipe && (
        <div className="px-4 pt-4">
          <div className="rounded-lg overflow-hidden border bg-secondary max-h-48 flex items-center justify-center">
            <img src={selectedSwipe.image_url} alt={selectedSwipe.name} className="max-h-48 object-contain" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Base: {selectedSwipe.name}</p>
        </div>
      )}

      <div className="px-4 py-3 space-y-3 border-b">
        <Textarea
          placeholder="Descreva as modificações que deseja no criativo..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="bg-secondary resize-none min-h-[80px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
          }}
        />

        {/* Brand Kit options */}
        {brandKit && (hasLogo || hasPersonPhotos) && (
          <div className="space-y-2 rounded-md border p-3 bg-secondary/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Assets do Brand Kit</p>
            {hasLogo && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={includeLogo} onCheckedChange={(v) => setIncludeLogo(!!v)} />
                <span className="text-xs">Incluir logo da marca</span>
                <img src={brandKit.logo_url!} alt="Logo" className="h-5 w-5 object-contain ml-auto rounded" />
              </label>
            )}
            {hasPersonPhotos && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={includePersonPhoto} onCheckedChange={(v) => { setIncludePersonPhoto(!!v); if (!v) setSelectedPersonPhoto(''); }} />
                  <span className="text-xs">Incluir foto de pessoa</span>
                </label>
                {includePersonPhoto && (
                  <div className="flex gap-2 flex-wrap pl-6">
                    {personPhotos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPersonPhoto(url)}
                        className={`w-10 h-10 rounded-md overflow-hidden border-2 transition-colors ${selectedPersonPhoto === url ? 'border-primary' : 'border-transparent'}`}
                      >
                        <img src={url} alt={`Pessoa ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-[100px] bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating || !selectedSwipe || !prompt.trim()} className="flex-1">
            {generating ? (<><Loader2 className="h-4 w-4 animate-spin mr-1" /> Gerando...</>) : (<><Zap className="h-4 w-4 mr-1 fill-primary-foreground" /> Gerar Criativo</>)}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Resultados</h3>
        {generating && (
          <div className="generating-pulse rounded-lg aspect-square bg-secondary mb-3 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {creatives?.map((c) => (
            <div key={c.id} className="group relative rounded-lg overflow-hidden border bg-secondary">
              <img src={c.image_url} alt={c.prompt} className="w-full object-cover" />
              <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => handleDownload(c.image_url, `creative-${c.id}.png`)} className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/80"><Download className="h-4 w-4" /></button>
                <button onClick={() => deleteCreative.mutate({ id: c.id, projectId: c.project_id })} className="p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="p-2">
                <p className="text-[10px] text-muted-foreground truncate">{c.prompt}</p>
                <p className="text-[10px] text-primary">{c.format}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
