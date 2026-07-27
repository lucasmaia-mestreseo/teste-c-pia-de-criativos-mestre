import { useMemo, useState } from 'react';
import { format, eachDayOfInterval, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AnalyticsFilters,
  defaultFilters,
  type AnalyticsFiltersValue,
} from '@/components/admin/AnalyticsFilters';
import {
  useCreativesInRange,
  useProfilesLite,
  useProjectsLite,
  useProjectLastCreative,
} from '@/hooks/useAnalytics';
import { ChartCard } from '@/components/admin/AnalyticsTeamTab';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type HealthStatus = 'ok' | 'warning' | 'critical';

interface ProjectHealth {
  id: string;
  name: string;
  lastAt: Date | null;
  daysSince: number | null;
  status: HealthStatus;
}

const STATUS_META: Record<HealthStatus, { label: string; badge: string; order: number }> = {
  critical: { label: 'Crítico / Abandonado', badge: 'bg-red-500/20 text-red-400 border-red-500/40', order: 0 },
  warning: { label: 'Atenção', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', order: 1 },
  ok: { label: 'Dentro do esperado', badge: 'bg-green-500/20 text-green-400 border-green-500/40', order: 2 },
};

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

export function AnalyticsClientsTab() {
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultFilters());
  const { data: projects = [] } = useProjectsLite();
  const { data: users = [] } = useProfilesLite();
  const { data: creatives = [], isLoading } = useCreativesInRange(filters);
  const { data: lastCreativeMap } = useProjectLastCreative();

  const byDay = useMemo(() => {
    const buckets = new Map<string, number>();
    const days = eachDayOfInterval({ start: filters.range.from, end: filters.range.to });
    for (const d of days) buckets.set(format(d, 'yyyy-MM-dd'), 0);
    for (const c of creatives) {
      const k = format(new Date(c.created_at), 'yyyy-MM-dd');
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      label: format(new Date(date), 'dd/MM', { locale: ptBR }),
      count,
    }));
  }, [creatives, filters.range]);

  const health: ProjectHealth[] = useMemo(() => {
    const now = new Date();
    const active = projects.filter((p) => p.active);
    const filtered = filters.projectId ? active.filter((p) => p.id === filters.projectId) : active;
    return filtered
      .map((p) => {
        const iso = lastCreativeMap?.get(p.id) ?? null;
        const lastAt = iso ? new Date(iso) : null;
        const daysSince = lastAt ? differenceInCalendarDays(now, lastAt) : null;
        let status: HealthStatus;
        if (daysSince === null || daysSince > 30) status = 'critical';
        else if (daysSince > 14) status = 'warning';
        else status = 'ok';
        return { id: p.id, name: p.name, lastAt, daysSince, status };
      })
      .sort((a, b) => {
        const s = STATUS_META[a.status].order - STATUS_META[b.status].order;
        if (s !== 0) return s;
        // within same status, oldest first
        const av = a.daysSince ?? Number.POSITIVE_INFINITY;
        const bv = b.daysSince ?? Number.POSITIVE_INFINITY;
        return bv - av;
      });
  }, [projects, lastCreativeMap, filters.projectId]);

  const groups = useMemo(() => {
    const g: Record<HealthStatus, ProjectHealth[]> = { critical: [], warning: [], ok: [] };
    for (const h of health) g[h.status].push(h);
    return g;
  }, [health]);

  return (
    <div className="space-y-6">
      <AnalyticsFilters value={filters} onChange={setFilters} projects={projects} users={users} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ChartCard title="Criativos por dia">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Saúde dos clientes (todos os projetos ativos)</h3>
        <HealthGroup title={STATUS_META.critical.label} status="critical" items={groups.critical} defaultOpen />
        <HealthGroup title={STATUS_META.warning.label} status="warning" items={groups.warning} defaultOpen />
        <HealthGroup title={STATUS_META.ok.label} status="ok" items={groups.ok} />
      </div>
    </div>
  );
}

function HealthGroup({
  title, status, items, defaultOpen = false,
}: { title: string; status: HealthStatus; items: ProjectHealth[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = STATUS_META[status];
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="outline" className={cn('ml-2', meta.badge)}>{items.length}</Badge>
        </div>
      </button>
      {open && (
        <div className="border-t divide-y">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Nenhum projeto nesta categoria.</div>
          ) : (
            items.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="font-medium truncate">{h.name}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {h.lastAt
                      ? `${format(h.lastAt, "dd/MM/yy", { locale: ptBR })} · há ${h.daysSince} ${h.daysSince === 1 ? 'dia' : 'dias'}`
                      : 'Nunca recebeu criativos'}
                  </span>
                  <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
