import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Save, Loader2, Globe, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ContextPanelProps {
  projectId: string | null;
}

export default function ContextPanel({ projectId }: ContextPanelProps) {
  const qc = useQueryClient();
  const [localContext, setLocalContext] = useState('');
  const [localVoice, setLocalVoice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [expandedField, setExpandedField] = useState<'context' | 'voice' | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project-context', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('context, voice_guide')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setLocalContext(project.context ?? '');
      setLocalVoice((project as any).voice_guide ?? '');
      setDirty(false);
    }
  }, [project]);

  const save = useMutation({
    mutationFn: async ({ context, voice_guide }: { context: string; voice_guide: string }) => {
      const { error } = await supabase
        .from('projects')
        .update({ context, voice_guide } as any)
        .eq('id', projectId!);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['project-context', projectId] });
      toast.success('Contexto salvo!');
    },
    onError: () => toast.error('Erro ao salvar contexto'),
  });

  const handleExtractFromUrl = async () => {
    if (!extractUrl.trim() || !projectId) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-context', {
        body: { url: extractUrl.trim(), projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.context) {
        setLocalContext(data.context);
        setDirty(true);
      }
      if (data.voiceGuide) {
        setLocalVoice(data.voiceGuide);
        setDirty(true);
      }
      toast.success('Contexto e tom de voz extraídos com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair contexto');
    } finally {
      setExtracting(false);
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
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Contexto do Projeto</h2>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <Button
              size="sm"
              onClick={() => save.mutate({ context: localContext, voice_guide: localVoice })}
              disabled={save.isPending}
              className="h-7 text-xs"
            >
              {save.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          )}
          {!dirty && localContext && (
            <span className="text-[10px] text-muted-foreground">✓ Salvo</span>
          )}
        </div>
      </div>

      {/* Extract from URL */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Extraia automaticamente o contexto e tom de voz a partir de uma URL.
        </p>
        <div className="flex gap-2">
          <Input
            value={extractUrl}
            onChange={(e) => setExtractUrl(e.target.value)}
            placeholder="https://exemplo.com.br"
            className="bg-secondary flex-1 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractFromUrl}
            disabled={extracting || !extractUrl.trim()}
            className="shrink-0"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            <span className="ml-1">Extrair</span>
          </Button>
        </div>
      </div>

      {/* Context */}
      <div className="space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase">Contexto</label>
          <button
            onClick={() => setExpandedField('context')}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Descreva tudo sobre o projeto: público-alvo, produto/serviço, tom de voz, ofertas, diferenciais, etc.
        </p>
        <Textarea
          value={localContext}
          onChange={(e) => { setLocalContext(e.target.value); setDirty(true); }}
          placeholder="Ex: Somos uma academia de crossfit focada em mulheres de 25-40 anos..."
          className="flex-1 bg-secondary resize-none text-sm min-h-[120px]"
        />
      </div>

      {/* Voice Guide */}
      <div className="space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase">Tom de Voz / Guia de Voz</label>
          <button
            onClick={() => setExpandedField('voice')}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Guia de voz da marca, extraído automaticamente ou editado manualmente.
        </p>
        <Textarea
          value={localVoice}
          onChange={(e) => { setLocalVoice(e.target.value); setDirty(true); }}
          placeholder="O guia de voz será gerado automaticamente ao extrair de uma URL, ou pode ser preenchido manualmente..."
          className="flex-1 bg-secondary resize-none text-sm min-h-[120px]"
        />
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={expandedField !== null} onOpenChange={(open) => { if (!open) setExpandedField(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {expandedField === 'context' ? 'Contexto' : 'Tom de Voz / Guia de Voz'}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={expandedField === 'context' ? localContext : localVoice}
            onChange={(e) => {
              if (expandedField === 'context') setLocalContext(e.target.value);
              else setLocalVoice(e.target.value);
              setDirty(true);
            }}
            className="flex-1 bg-secondary resize-none text-sm"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
