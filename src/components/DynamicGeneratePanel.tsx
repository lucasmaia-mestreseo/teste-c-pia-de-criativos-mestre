import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Loader2, Sparkles, ShieldCheck, Lightbulb, Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface DynamicGeneratePanelProps {
  projectId: string | null;
}

interface CreativeResult {
  type: string;
  briefing: {
    titulo: string;
    copy: string;
    proposta_imagem: string;
    objetivo_estrategico: string;
  };
  imageUrl: string;
}

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
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<CreativeResult[]>([]);

  const toggleType = (id: string) => {
    setSelectedTypes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const anySelected = Object.values(selectedTypes).some(Boolean);

  const handleGenerate = async () => {
    if (!projectId || !anySelected) return;
    setGenerating(true);
    setResults([]);

    const types = Object.entries(selectedTypes)
      .filter(([, v]) => v)
      .map(([type]) => ({ type, count: counts[type] || 1 }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-dynamic-creative', {
        body: { projectId, types },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      toast.success(`${data.results?.length || 0} criativos gerados!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar criativos');
    } finally {
      setGenerating(false);
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Config area */}
      <div className="p-6 border-b space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Geração Dinâmica</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione os tipos de criativos e a quantidade de cada um. O sistema irá gerar briefings estratégicos e imagens automaticamente.
        </p>

        <div className="space-y-4">
          {TYPE_CONFIG.map(({ id, label, description, icon: Icon, color }) => (
            <div key={id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Checkbox
                checked={!!selectedTypes[id]}
                onCheckedChange={() => toggleType(id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                {selectedTypes[id] && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Quantidade</Label>
                      <span className="text-xs font-semibold">{counts[id]}</span>
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

        <Button
          onClick={handleGenerate}
          disabled={generating || !anySelected}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Gerando criativos...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Criativos
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">
            Resultados ({results.length} criativos)
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {results.map((r, i) => (
              <div key={i} className="rounded-lg border bg-card overflow-hidden">
                {r.imageUrl && (
                  <img src={r.imageUrl} alt={r.briefing.titulo} className="w-full aspect-square object-cover" />
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {typeLabel[r.type] || r.type}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm">{r.briefing.titulo}</h4>
                  <p className="text-xs text-muted-foreground">{r.briefing.copy}</p>
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Proposta visual:</strong> {r.briefing.proposta_imagem}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Objetivo:</strong> {r.briefing.objetivo_estrategico}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
