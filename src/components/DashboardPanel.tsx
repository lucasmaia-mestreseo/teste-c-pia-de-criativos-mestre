import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, TrendingUp, Image, FolderOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardPanelProps {
  onSelectProject: (id: string) => void;
}

export default function DashboardPanel({ onSelectProject }: DashboardPanelProps) {
  const { total, last7Days, recentCreatives, recentProjects, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-8 overflow-y-auto h-full space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary fill-primary" />
          Dashboard
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua atividade criativa</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Image className="h-4 w-4" />
              Total de Criativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{last7Days}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent creatives */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Últimos criativos gerados</h3>
        {recentCreatives.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum criativo gerado ainda.</p>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {recentCreatives.map((c) => (
              <div key={c.id} className="group relative rounded-lg overflow-hidden border border-border bg-secondary aspect-square">
                <img
                  src={c.image_url}
                  alt="Criativo"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center p-2">
                  <span className="text-xs text-white/80">{c.format}</span>
                  <span className="text-[10px] text-white/60 mt-1">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent projects */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Projetos com criativos
        </h3>
        {recentProjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum projeto com criativos ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-transparent bg-secondary hover:border-primary/50 hover:text-primary transition-all text-left"
              >
                <span className="font-medium text-sm">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(p.lastGenerated), { addSuffix: true, locale: ptBR })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
