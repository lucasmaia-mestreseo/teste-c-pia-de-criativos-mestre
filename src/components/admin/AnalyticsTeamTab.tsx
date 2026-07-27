import { useMemo, useState } from 'react';
import { format, eachDayOfInterval, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { Loader2 } from 'lucide-react';
import {
  AnalyticsFilters,
  defaultFilters,
  type AnalyticsFiltersValue,
} from '@/components/admin/AnalyticsFilters';
import {
  useCreativesInRange,
  useProfilesLite,
  useProjectsLite,
} from '@/hooks/useAnalytics';

export function AnalyticsTeamTab() {
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultFilters());
  const { data: projects = [] } = useProjectsLite();
  const { data: users = [] } = useProfilesLite();
  const { data: creatives = [], isLoading } = useCreativesInRange(filters);

  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);
  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);

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

  const topProjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of creatives) counts.set(c.project_id, (counts.get(c.project_id) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: projectName.get(id) ?? '—', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [creatives, projectName]);

  const topUsers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of creatives) {
      if (!c.created_by) continue;
      counts.set(c.created_by, (counts.get(c.created_by) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: userName.get(id) ?? '—', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [creatives, userName]);

  const kpis = useMemo(() => {
    const uniqueUsers = new Set(creatives.map((c) => c.created_by).filter(Boolean)).size;
    const uniqueProjects = new Set(creatives.map((c) => c.project_id)).size;
    const days = Math.max(1, differenceInCalendarDays(filters.range.to, filters.range.from) + 1);
    return {
      total: creatives.length,
      uniqueUsers,
      uniqueProjects,
      avgPerDay: (creatives.length / days).toFixed(1),
    };
  }, [creatives, filters.range]);

  return (
    <div className="space-y-6">
      <AnalyticsFilters value={filters} onChange={setFilters} projects={projects} users={users} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Criativos" value={kpis.total} />
        <Kpi label="Analistas ativos" value={kpis.uniqueUsers} />
        <Kpi label="Projetos ativos" value={kpis.uniqueProjects} />
        <Kpi label="Média/dia" value={kpis.avgPerDay} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Top 10 clientes">
              {topProjects.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={Math.max(220, topProjects.length * 32)}>
                  <BarChart data={topProjects} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top 10 analistas">
              {topUsers.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={Math.max(220, topUsers.length * 32)}>
                  <BarChart data={topUsers} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</div>;
}
