import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { listManuals, manualLabel } from '@/kv/manualStorage';

/**
 * Brand Kit ↔ Criação de KVs: shows the client's latest brand manual (or
 * invites to create one) so the identity and the manual stay connected.
 */
export default function BrandManualBanner({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: manuals } = useQuery({
    queryKey: ['kv-manuals', projectId],
    queryFn: () => listManuals(projectId),
    staleTime: 60_000,
  });
  const latest = manuals?.[0];
  const label = latest ? manualLabel(latest) : null;

  return (
    <button
      onClick={() => navigate(`/project/${projectId}/kv`)}
      className="group w-full text-left rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-card p-4 flex items-center gap-4 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-none shadow">
        <BookOpenCheck className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {latest ? 'Manual de comunicação digital' : 'Crie o manual de marca deste cliente'}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {latest
            ? `${manuals!.length} manual(is) salvo(s) · último em ${label?.date}. Aplicar um manual atualiza este Brand Kit.`
            : 'Suba brandbook, logo e peças em Criação de KVs: a IA monta as 38 páginas e alimenta este Brand Kit.'}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
    </button>
  );
}
