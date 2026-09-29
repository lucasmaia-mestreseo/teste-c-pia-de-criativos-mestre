import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { KIND_LABELS } from '@/lib/creativeOps';

/**
 * Painel de Custos (leve): quanto a IA custou no período, por projeto,
 * por recurso e por modelo. Fonte: tabela ai_usage (uma linha por chamada
 * ao OpenRouter) + generated_creatives.cost_usd.
 */

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const;

const FEATURE_LABELS: Record<string, string> = {
  'generate-creative': 'Gerar criativo',
  'generate-dynamic-creative': 'Dinâmica',
  'transform-creative:resize': 'Redimensionar',
  'transform-creative:unfold': 'Desdobramento',
  'transform-creative:fix': 'Correção pós-revisão',
  'review-creative': 'Revisão automática',
  'analyze-swipe': 'Análise de swipe',
  'suggest-texts': 'Sugestão de textos',
  'suggest-creatives': 'Sugestão de criativos',
  'extract-context': 'Extração de contexto',
  'extract-branding': 'Extração de branding',
  'generate-person-grid': 'Grid de pessoa',
};

const PAGE = 1000; // PostgREST returns at most 1000 rows per request
const MAX_ROWS = 50000;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const usd = (v: number, digits = 2) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const int = (v: number) => v.toLocaleString('pt-BR');

interface Row { key: string; label: string; calls: number; cost: number }
interface UsageRow { function_name: string; model: string; project_id: string | null; cost_usd: number | null; success: boolean }
interface CreativeCostRow { kind: string; cost_usd: number | null }

function aggregate<T>(items: T[], keyOf: (i: T) => string, labelOf: (k: string) => string, costOf: (i: T) => number): Row[] {
  const map = new Map<string, Row>();
  for (const i of items) {
    const k = keyOf(i);
    const row = map.get(k) ?? { key: k, label: labelOf(k), calls: 0, cost: 0 };
    row.calls++;
    row.cost += costOf(i);
    map.set(k, row);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost || b.calls - a.calls);
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

/** Ranked table with a single-hue share bar (magnitude only — the number is always shown as text). */
function RankedTable({ title, rows, total, limit = 8, countLabel = 'Chamadas' }: { title: string; rows: Row[]; total: number; limit?: number; countLabel?: string }) {
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const restRow: Row | null = rest.length
    ? { key: '__other', label: `Outros (${rest.length})`, calls: rest.reduce((n, r) => n + r.calls, 0), cost: rest.reduce((n, r) => n + r.cost, 0) }
    : null;
  const list = restRow ? [...shown, restRow] : shown;
  const max = Math.max(...list.map((r) => r.cost), 0);

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-2.5 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground px-4 py-6">Sem dados no período.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-normal px-4 py-1.5">Nome</th>
              <th className="text-right font-normal px-2 py-1.5">{countLabel}</th>
              <th className="text-right font-normal px-4 py-1.5">Custo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const share = total > 0 ? r.cost / total : 0;
              return (
                <tr key={r.key} className="border-t hover:bg-secondary/50" title={`${r.label}: ${usd(r.cost, 4)} · ${(share * 100).toFixed(1)}% do total · ${int(r.calls)} ${countLabel.toLowerCase()}`}>
                  <td className="px-4 py-2">
                    <div className="truncate max-w-[220px]">{r.label}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? (r.cost / max) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums text-muted-foreground">{int(r.calls)}</td>
                  <td className="text-right px-4 py-2 tabular-nums font-medium">{usd(r.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CostsTab() {
  const [days, setDays] = useState<number>(30);
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-costs', days],
    queryFn: async () => {
      const [usage, creatives, projects] = await Promise.all([
        fetchAll<UsageRow>((from, to) => supabase
          .from('ai_usage')
          .select('function_name, model, project_id, cost_usd, success')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .range(from, to)),
        fetchAll<CreativeCostRow>((from, to) => supabase
          .from('generated_creatives')
          .select('kind, cost_usd')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .range(from, to)),
        supabase.from('projects').select('id, name'),
      ]);
      return { usage, creatives, projects: projects.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const names = new Map(data.projects.map((p) => [p.id, p.name]));
    const cost = (u: { cost_usd: number | null }) => Number(u.cost_usd) || 0;
    const usageCost = (u: UsageRow) => cost(u);
    const creativeCost = (c: CreativeCostRow) => cost(c);
    const total = data.usage.reduce((n, u) => n + cost(u), 0);
    const failed = data.usage.filter((u) => !u.success).length;
    const withCost = data.creatives.filter((c) => c.cost_usd !== null);
    const creativeTotal = withCost.reduce((n, c) => n + cost(c), 0);
    return {
      total,
      calls: data.usage.length,
      failed,
      creatives: data.creatives.length,
      avgPerCreative: withCost.length ? creativeTotal / withCost.length : null,
      byProject: aggregate(data.usage, (u) => u.project_id ?? '—', (k) => (k === '—' ? 'Sem projeto' : names.get(k) ?? 'Projeto removido'), usageCost),
      byFeature: aggregate(data.usage, (u) => u.function_name, (k) => FEATURE_LABELS[k] ?? k, usageCost),
      byModel: aggregate(data.usage, (u) => u.model, (k) => k, usageCost),
      byKind: aggregate(data.creatives, (c) => c.kind ?? 'generate', (k) => KIND_LABELS[k] ?? k, creativeCost),
    };
  }, [data]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Custos de IA</h2>
          <p className="text-xs text-muted-foreground">Valores informados pelo OpenRouter a cada chamada.</p>
        </div>
        <div className="inline-flex rounded-md border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0',
                days === p.days ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-primary hover:bg-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar os custos: {(error as Error).message}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Gasto total" value={usd(stats.total)} hint={`últimos ${days} dias`} />
            <StatTile label="Chamadas de IA" value={int(stats.calls)} hint={stats.failed ? `${int(stats.failed)} com erro` : 'nenhuma com erro'} />
            <StatTile label="Criativos gerados" value={int(stats.creatives)} />
            <StatTile
              label="Custo médio por criativo"
              value={stats.avgPerCreative === null ? '—' : usd(stats.avgPerCreative, 3)}
              hint="só a geração da imagem"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <RankedTable title="Por projeto" rows={stats.byProject} total={stats.total} />
            <RankedTable title="Por recurso" rows={stats.byFeature} total={stats.total} />
            <RankedTable title="Por modelo" rows={stats.byModel} total={stats.total} />
            <RankedTable title="Criativos por origem (custo da imagem)" countLabel="Criativos" rows={stats.byKind} total={stats.byKind.reduce((n, r) => n + r.cost, 0)} />
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-px flex-shrink-0" />
            O registro de custos começou com a atualização de redimensionar/desdobramento; gerações anteriores não aparecem aqui.
            Chamadas com erro normalmente não são cobradas pelo OpenRouter.
          </p>
        </>
      )}
    </div>
  );
}
