import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveGuide } from '@/kv/manualStorage';

export function useActiveGuide(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['active-guide', projectId],
    queryFn: () => getActiveGuide(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/** Which brand guide (manual from Criação de KVs) this project's generations follow. */
export default function ActiveGuideBadge({ projectId, className }: { projectId: string; className?: string }) {
  const navigate = useNavigate();
  const { data: guide, isLoading } = useActiveGuide(projectId);
  if (isLoading) return null;
  return (
    <button onClick={() => navigate(`/project/${projectId}/kv`)}
      title={guide ? 'Guia de marca ativo — trocar em Criação de KVs' : 'Criar o guia de marca deste projeto'}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-colors max-w-full animate-in fade-in duration-300',
        guide ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : 'border-dashed text-muted-foreground hover:text-primary hover:border-primary/40', className)}>
      {guide ? <BookOpenCheck className="h-3 w-3 flex-none" /> : <Plus className="h-3 w-3 flex-none" />}
      <span className="truncate">{guide ? <>Guia: <b className="capitalize">{guide.campaign}</b> · <span className="capitalize">{guide.brand}</span></> : 'Sem guia de marca — criar em KVs'}</span>
    </button>
  );
}
