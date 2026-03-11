import { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ContextPanelProps {
  projectId: string | null;
}

export default function ContextPanel({ projectId }: ContextPanelProps) {
  const qc = useQueryClient();
  const [localValue, setLocalValue] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project-context', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('context')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setLocalValue(project.context ?? '');
      setDirty(false);
    }
  }, [project]);

  const save = useMutation({
    mutationFn: async (context: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ context })
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

  // Auto-save with debounce
  useEffect(() => {
    if (!dirty || !projectId) return;
    const t = setTimeout(() => save.mutate(localValue), 1500);
    return () => clearTimeout(t);
  }, [localValue, dirty, projectId]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Contexto do Projeto</h2>
        {dirty && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {save.isPending ? 'Salvando...' : 'Alterações pendentes'}
          </span>
        )}
        {!dirty && localValue && (
          <span className="text-[10px] text-muted-foreground ml-auto">✓ Salvo</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Descreva tudo sobre o projeto: público-alvo, produto/serviço, tom de voz, ofertas, diferenciais, etc. 
        Essas informações serão usadas pela IA para sugerir textos nos criativos.
      </p>
      <Textarea
        value={localValue}
        onChange={(e) => { setLocalValue(e.target.value); setDirty(true); }}
        placeholder="Ex: Somos uma academia de crossfit focada em mulheres de 25-40 anos. Tom de voz motivacional e empoderador. Oferecemos primeira aula grátis. Diferenciais: turmas pequenas, acompanhamento nutricional incluso..."
        className="flex-1 bg-secondary resize-none text-sm"
      />
    </div>
  );
}
