import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, ShieldCheck, Lightbulb, Rocket, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ImageAttachments from './ImageAttachments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FreePromptData {
  prompt: string;
  attachedImages: string[];
}

interface Suggestion {
  type: 'conservative' | 'innovative' | 'radical';
  titulo: string;
  copy: string;
  proposta_imagem: string;
  objetivo_estrategico: string;
}

interface FreePromptPanelProps {
  projectId: string;
  data: FreePromptData;
  onChange: (data: FreePromptData) => void;
}

const TYPE_CONFIG = [
  { id: 'conservative' as const, label: 'Conservador', icon: ShieldCheck, color: 'text-blue-400' },
  { id: 'innovative' as const, label: 'Inovador', icon: Lightbulb, color: 'text-amber-400' },
  { id: 'radical' as const, label: 'Fora da Caixa', icon: Rocket, color: 'text-rose-400' },
];

function formatSuggestion(s: Suggestion): string {
  return `Título: ${s.titulo}\nCopy: ${s.copy}\nImagem: ${s.proposta_imagem}\nObjetivo: ${s.objetivo_estrategico}`;
}

export default function FreePromptPanel({ projectId, data, onChange }: FreePromptPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('suggest-creatives', {
        body: { projectId },
      });
      if (error) throw error;
      const items = result?.suggestions || result;
      if (!Array.isArray(items) || items.length === 0) throw new Error('No suggestions returned');
      setSuggestions(items);
      setSelectedIndex(null);
      toast.success('Sugestões geradas com sucesso!');
    } catch (e: any) {
      console.error('suggest-creatives error:', e);
      toast.error(e?.message || 'Erro ao gerar sugestões');
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (index: number) => {
    const text = formatSuggestion(suggestions[index]);
    onChange({ ...data, prompt: text });
    setSelectedIndex(index);
  };

  const handleCardClick = (index: number) => {
    // Deselect if already selected
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    // If prompt is empty or was previously set by a suggestion, apply directly
    if (!data.prompt.trim()) {
      applySuggestion(index);
    } else {
      setConfirmIndex(index);
    }
  };

  const handleConfirm = () => {
    if (confirmIndex !== null) {
      applySuggestion(confirmIndex);
      setConfirmIndex(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Prompt Livre</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Descreva o criativo que deseja gerar. Você pode anexar imagens como referência.
          </p>
          <Textarea
            placeholder="Descreva o criativo que você quer criar..."
            value={data.prompt}
            onChange={(e) => onChange({ ...data, prompt: e.target.value })}
            className="bg-secondary resize-none min-h-[200px] text-sm"
          />
        </div>

        <ImageAttachments
          projectId={projectId}
          images={data.attachedImages}
          onChange={(imgs) => onChange({ ...data, attachedImages: imgs })}
        />

        {/* AI Suggestions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {suggesting ? 'Gerando sugestões...' : 'Sugerir Criativos com IA'}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => {
                const config = TYPE_CONFIG.find((c) => c.id === s.type) || TYPE_CONFIG[i];
                const Icon = config.icon;
                const isSelected = selectedIndex === i;

                return (
                  <button
                    key={i}
                    onClick={() => handleCardClick(i)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className={`text-xs font-semibold uppercase ${config.color}`}>{config.label}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.copy}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmIndex !== null} onOpenChange={(open) => !open && setConfirmIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir prompt atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe conteúdo no prompt. Deseja substituí-lo pela sugestão selecionada?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
