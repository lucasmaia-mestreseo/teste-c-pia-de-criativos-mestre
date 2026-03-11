import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import ImageAttachments from './ImageAttachments';
import { Monitor, ArrowRightLeft, Star, List, UserCheck, Play, Tag, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image';
  placeholder?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fields: TemplateField[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'Produto no centro com headline e CTA',
    icon: <Monitor className="h-4 w-4" />,
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Ex: O app que muda tudo' },
      { key: 'subheadline', label: 'Subheadline', type: 'text', placeholder: 'Ex: Simples. Rápido. Poderoso.' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Baixe Agora' },
      { key: 'product_description', label: 'Descrição do produto/visual central', type: 'textarea', placeholder: 'Descreva o produto ou elemento central...' },
    ],
  },
  {
    id: 'problem-solution',
    name: 'Problema → Solução',
    description: 'Contraste visual entre dor e solução',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    fields: [
      { key: 'problem', label: 'Texto do Problema', type: 'textarea', placeholder: 'Descreva a dor do público...' },
      { key: 'solution', label: 'Texto da Solução', type: 'textarea', placeholder: 'Descreva como você resolve...' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Comece Agora' },
    ],
  },
  {
    id: 'main-benefit',
    name: 'Benefício Principal',
    description: 'Headline dominante com visual de apoio',
    icon: <Star className="h-4 w-4" />,
    fields: [
      { key: 'headline', label: 'Headline Grande', type: 'text', placeholder: 'Ex: Economize 10h por semana' },
      { key: 'visual_description', label: 'Descrição do visual de apoio', type: 'textarea', placeholder: 'Descreva a imagem de apoio...' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Saiba Mais' },
    ],
  },
  {
    id: 'list-ad',
    name: 'Lista (List Ad)',
    description: '3 a 5 benefícios em bullet points',
    icon: <List className="h-4 w-4" />,
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Ex: Por que escolher a gente?' },
      { key: 'bullets', label: 'Benefícios (um por linha)', type: 'textarea', placeholder: '✓ Benefício 1\n✓ Benefício 2\n✓ Benefício 3' },
      { key: 'visual_description', label: 'Descrição do visual de apoio', type: 'textarea', placeholder: 'Descreva a imagem de apoio...' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Teste Grátis' },
    ],
  },
  {
    id: 'authority',
    name: 'Autoridade',
    description: 'Especialista + prova social + credenciais',
    icon: <UserCheck className="h-4 w-4" />,
    fields: [
      { key: 'headline', label: 'Headline de Autoridade', type: 'text', placeholder: 'Ex: +500 alunos formados' },
      { key: 'social_proof', label: 'Prova Social', type: 'textarea', placeholder: 'Números, depoimentos, credenciais...' },
      { key: 'person_description', label: 'Descrição do especialista', type: 'textarea', placeholder: 'Homem de terno, fundo escuro...' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Inscreva-se' },
    ],
  },
  {
    id: 'demonstration',
    name: 'Demonstração',
    description: 'Produto em uso com destaques visuais',
    icon: <Play className="h-4 w-4" />,
    fields: [
      { key: 'headline', label: 'Headline Explicativa', type: 'text', placeholder: 'Ex: Veja como funciona' },
      { key: 'features', label: 'Funcionalidades/Destaques (um por linha)', type: 'textarea', placeholder: '→ Recurso 1\n→ Recurso 2\n→ Recurso 3' },
      { key: 'product_description', label: 'Descrição do produto em uso', type: 'textarea', placeholder: 'Interface do app com...' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Experimente' },
    ],
  },
  {
    id: 'direct-offer',
    name: 'Oferta Direta',
    description: 'Oferta destacada com urgência',
    icon: <Tag className="h-4 w-4" />,
    fields: [
      { key: 'offer', label: 'Oferta Destacada', type: 'text', placeholder: 'Ex: 50% OFF só hoje!' },
      { key: 'product_description', label: 'Descrição do produto/visual', type: 'textarea', placeholder: 'Descreva o produto...' },
      { key: 'urgency', label: 'Elemento de Urgência', type: 'text', placeholder: 'Ex: Últimas 24 horas' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Ex: Comprar Agora' },
    ],
  },
];

export interface TemplateData {
  templateId: string | null;
  fields: Record<string, string>;
  prompt: string;
  attachedImages: string[];
}

interface TemplatesPanelProps {
  projectId: string;
  data: TemplateData;
  onChange: (data: TemplateData) => void;
}

export default function TemplatesPanel({ projectId, data, onChange }: TemplatesPanelProps) {
  const selectedTemplate = TEMPLATES.find((t) => t.id === data.templateId);
  const [filling, setFilling] = useState(false);

  const selectTemplate = (id: string) => {
    onChange({ templateId: id, fields: {}, prompt: data.prompt, attachedImages: data.attachedImages });
  };

  const updateField = (key: string, value: string) => {
    onChange({ ...data, fields: { ...data.fields, [key]: value } });
  };

  const handleAiFill = async () => {
    if (!selectedTemplate) return;
    setFilling(true);
    try {
      const { data: project, error: pErr } = await supabase
        .from('projects')
        .select('context')
        .eq('id', projectId)
        .single();
      if (pErr || !project?.context) {
        toast({ title: 'Contexto não encontrado', description: 'Configure o contexto do projeto antes de usar o preenchimento com IA.', variant: 'destructive' });
        return;
      }

      const texts = selectedTemplate.fields.map((f) => ({
        id: f.key,
        role: f.key,
        content: data.fields[f.key] || f.placeholder || '',
        position: f.label,
      }));

      const { data: result, error } = await supabase.functions.invoke('suggest-texts', {
        body: { context: project.context, texts },
      });

      if (error) throw error;

      const newFields = { ...data.fields };
      (result.suggestions as { id: string; text: string }[]).forEach((s) => {
        newFields[s.id] = s.text;
      });
      onChange({ ...data, fields: newFields });
      toast({ title: 'Campos preenchidos com IA ✨' });
    } catch (e: any) {
      console.error('AI fill error:', e);
      toast({ title: 'Erro ao preencher', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setFilling(false);
    }
  };

  if (!selectedTemplate) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Modelos</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-secondary/50 hover:bg-secondary transition-colors text-left"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary">{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button
          onClick={() => onChange({ ...data, templateId: null, fields: {} })}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">{selectedTemplate.icon}</div>
        <h2 className="text-sm font-semibold flex-1">{selectedTemplate.name}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleAiFill}
                disabled={filling}
              >
                {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                IA
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preencher campos com IA usando o contexto do projeto</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>

          {selectedTemplate.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              {f.type === 'textarea' ? (
                <Textarea
                  placeholder={f.placeholder}
                  value={data.fields[f.key] ?? ''}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="bg-secondary resize-none min-h-[80px] text-sm"
                />
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={data.fields[f.key] ?? ''}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="bg-secondary text-sm"
                />
              )}
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Instruções adicionais (opcional)</label>
            <Textarea
              placeholder="Adicione detalhes extras sobre o criativo..."
              value={data.prompt}
              onChange={(e) => onChange({ ...data, prompt: e.target.value })}
              className="bg-secondary resize-none min-h-[60px] text-sm"
            />
          </div>

          <ImageAttachments
            projectId={projectId}
            images={data.attachedImages}
            onChange={(imgs) => onChange({ ...data, attachedImages: imgs })}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
