import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, FileCode } from 'lucide-react';

interface PromptRow {
  id: string;
  prompt: string;
  style_prompt: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  hero: 'Hero',
  'problem-solution': 'Problema → Solução',
  'main-benefit': 'Benefício Principal',
  'list-ad': 'Lista (List Ad)',
  authority: 'Autoridade',
  demonstration: 'Demonstração',
  'direct-offer': 'Oferta Direta',
};

export default function AdminPrompts() {
  const { role, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [styleEdits, setStyleEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && role === 'owner') {
      supabase
        .from('template_prompts')
        .select('id, prompt, style_prompt')
        .then(({ data }) => {
          setPrompts(data || []);
          setLoading(false);
        });
    }
  }, [authLoading]);

  if (authLoading) return null;
  if (role !== 'owner') return <Navigate to="/" replace />;

  const handleSave = async (id: string) => {
    const newPrompt = edits[id];
    if (newPrompt === undefined) return;
    setSaving(id);
    const { error } = await supabase
      .from('template_prompts')
      .update({ prompt: newPrompt, updated_by: user!.id })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Prompt salvo!');
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, prompt: newPrompt } : p)));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setSaving(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-5 py-3 border-b bg-card">
        <Button size="icon" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileCode className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Editar Prompts de Modelos</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          prompts.map((p) => (
            <div key={p.id} className="space-y-2 p-4 rounded-lg border bg-card">
              <h3 className="text-sm font-semibold text-primary">
                {TEMPLATE_LABELS[p.id] || p.id}
              </h3>
              <Textarea
                value={edits[p.id] ?? p.prompt}
                onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="bg-secondary min-h-[120px] text-sm font-mono"
              />
              {edits[p.id] !== undefined && edits[p.id] !== p.prompt && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => handleSave(p.id)} disabled={saving === p.id}>
                    {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
