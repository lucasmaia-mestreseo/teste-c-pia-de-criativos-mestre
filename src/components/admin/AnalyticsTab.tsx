import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AnalyticsTeamTab } from '@/components/admin/AnalyticsTeamTab';
import { AnalyticsClientsTab } from '@/components/admin/AnalyticsClientsTab';

type View = 'team' | 'clients';

export function AnalyticsTab() {
  const [view, setView] = useState<View>('team');
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-md border overflow-hidden">
        {([
          { id: 'team' as const, label: 'Análise de Time' },
          { id: 'clients' as const, label: 'Análise de Clientes' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-r last:border-r-0',
              view === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-primary hover:bg-secondary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'team' ? <AnalyticsTeamTab /> : <AnalyticsClientsTab />}
    </div>
  );
}
