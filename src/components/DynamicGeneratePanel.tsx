import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, ShieldCheck, Lightbulb, Rocket } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCreativeFormats } from '@/hooks/useCreativeFormats';
import { useQueryClient } from '@tanstack/react-query';

interface DynamicGeneratePanelProps {
  projectId: string | null;
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
  const [format, setFormat] = useState<string>('1:1');
  const [ignoreBrandKit, setIgnoreBrandKit] = useState(false);
  const [ignoreContext, setIgnoreContext] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: formats } = useCreativeFormats();
  const qc = useQueryClient();

  const formatLabels = (formats || []).map((f: any) => f.label as string);
  const FORMATS = formatLabels.length > 0 ? formatLabels : ['9:16', '4:5', '1:1', '16:9'];

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
        body: { projectId, types, format, ignoreBrandKit, ignoreContext },
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

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={ignoreBrandKit} onCheckedChange={(v) => setIgnoreBrandKit(!!v)} className="h-3.5 w-3.5" />
          <span className="text-[10px] text-muted-foreground">Ignorar Brand Kit</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={ignoreContext} onCheckedChange={(v) => setIgnoreContext(!!v)} className="h-3.5 w-3.5" />
          <span className="text-[10px] text-muted-foreground">Ignorar Contexto</span>
        </label>
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
  );
}
