import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Loader2, Palette, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompleteOnboarding } from '@/hooks/useProject';

interface Props {
  projectId: string;
  projectName?: string;
  /** Opens the Brand Kit step-by-step (the existing onboarding). */
  onCreateBrandKit: () => void;
}

/**
 * First screen of a new project in Gerar: how to start. The Brand Kit is
 * recommended but no longer mandatory — people can generate right away and
 * fill it in later (Brand Kit tab) or build it from a manual (KVs).
 */
export default function ProjectStart({ projectId, projectName, onCreateBrandKit }: Props) {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();

  const skip = async () => {
    try {
      await complete.mutateAsync(projectId);
      toast.success('Pronto, pode gerar!', { description: 'Quando quiser, complete o Brand Kit na aba Brand Kit.' });
    } catch {
      toast.error('Não foi possível continuar. Tente de novo.');
    }
  };

  const options = [
    {
      id: 'kit', icon: Palette, title: 'Criar Brand Kit', badge: 'Recomendado',
      text: 'Cores, logo, tipografia e o contexto do cliente. Leva poucos minutos e deixa cada criativo com a cara da marca.',
      action: onCreateBrandKit,
    },
    {
      id: 'kv', icon: BookOpenCheck, title: 'Criar pelo manual (KVs)',
      text: 'Tem brandbook ou briefing? A Criação de KVs lê os materiais, monta o manual e preenche o Brand Kit sozinha.',
      action: () => navigate(`/project/${projectId}/kv`),
    },
    {
      id: 'skip', icon: Zap, title: 'Seguir sem Brand Kit por enquanto',
      text: 'Gere já, descrevendo a marca no pedido. O Brand Kit fica para depois, na aba Brand Kit.',
      action: skip,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Projeto novo</p>
          <h1 className="text-2xl sm:text-3xl font-bold">Como você quer começar este projeto?</h1>
          {projectName && <p className="text-sm font-medium text-foreground/80 truncate max-w-xl mx-auto" title={projectName}>{projectName}</p>}
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">A identidade da marca é o que faz os criativos saírem certos. Mas dá para começar sem ela.</p>
        </div>
        <div className="grid gap-3 stagger">
          {options.map((o) => {
            const Icon = o.icon;
            const busy = o.id === 'skip' && complete.isPending;
            return (
              <button key={o.id} onClick={o.action} disabled={complete.isPending}
                className={cn('group w-full flex items-center gap-4 rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60',
                  o.id === 'kit' ? 'border-primary/50 bg-primary/[0.06] hover:border-primary' : 'bg-card hover:border-primary/40')}>
                <span className={cn('h-12 w-12 rounded-xl flex items-center justify-center flex-none transition-transform group-hover:scale-105',
                  o.id === 'kit' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary')}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-bold">{o.title}</span>
                    {o.badge && <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">{o.badge}</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground mt-1 leading-relaxed">{o.text}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-1" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
