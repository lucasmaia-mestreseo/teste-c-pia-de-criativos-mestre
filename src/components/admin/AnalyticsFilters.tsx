import { useMemo, useState } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export type PresetKey = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsRange {
  preset: PresetKey;
  from: Date;
  to: Date;
}

export interface AnalyticsFiltersValue {
  range: AnalyticsRange;
  projectId: string | null;
  userId: string | null;
}

export function computeRange(preset: PresetKey, custom?: { from?: Date; to?: Date }): AnalyticsRange {
  const now = new Date();
  const end = endOfDay(now);
  switch (preset) {
    case 'today':
      return { preset, from: startOfDay(now), to: end };
    case '7d':
      return { preset, from: startOfDay(subDays(now, 6)), to: end };
    case '30d':
      return { preset, from: startOfDay(subDays(now, 29)), to: end };
    case '90d':
      return { preset, from: startOfDay(subDays(now, 89)), to: end };
    case 'custom': {
      const from = custom?.from ? startOfDay(custom.from) : startOfDay(subDays(now, 29));
      const to = custom?.to ? endOfDay(custom.to) : end;
      return { preset, from, to };
    }
  }
}

export const defaultFilters = (): AnalyticsFiltersValue => ({
  range: computeRange('30d'),
  projectId: null,
  userId: null,
});

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'custom', label: 'Personalizado' },
];

interface Option { id: string; name: string }

interface Props {
  value: AnalyticsFiltersValue;
  onChange: (v: AnalyticsFiltersValue) => void;
  projects: Option[];
  users: Option[];
}

export function AnalyticsFilters({ value, onChange, projects, users }: Props) {
  const [projOpen, setProjOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const projLabel = useMemo(
    () => (value.projectId ? projects.find((p) => p.id === value.projectId)?.name ?? 'Projeto' : 'Todos os projetos'),
    [value.projectId, projects]
  );
  const userLabel = useMemo(
    () => (value.userId ? users.find((u) => u.id === value.userId)?.name ?? 'Usuário' : 'Todos os usuários'),
    [value.userId, users]
  );

  const setPreset = (key: PresetKey) => {
    if (key === 'custom') {
      onChange({ ...value, range: computeRange('custom', { from: value.range.from, to: value.range.to }) });
      setRangeOpen(true);
    } else {
      onChange({ ...value, range: computeRange(key) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0',
              value.range.preset === p.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-primary hover:bg-secondary'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.range.preset === 'custom' && (
        <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(value.range.from, 'dd/MM/yy', { locale: ptBR })} — {format(value.range.to, 'dd/MM/yy', { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: value.range.from, to: value.range.to }}
              onSelect={(r) => {
                if (r?.from && r?.to) {
                  onChange({ ...value, range: computeRange('custom', { from: r.from, to: r.to }) });
                }
              }}
              numberOfMonths={2}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      )}

      <Popover open={projOpen} onOpenChange={setProjOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" role="combobox" className="justify-between gap-2 min-w-[180px] text-xs">
            <span className="truncate">{projLabel}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[260px]" align="start">
          <Command>
            <CommandInput placeholder="Buscar projeto..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum projeto</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => { onChange({ ...value, projectId: null }); setProjOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value.projectId ? 'opacity-100' : 'opacity-0')} />
                  Todos os projetos
                </CommandItem>
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => { onChange({ ...value, projectId: p.id }); setProjOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value.projectId === p.id ? 'opacity-100' : 'opacity-0')} />
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={userOpen} onOpenChange={setUserOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" role="combobox" className="justify-between gap-2 min-w-[180px] text-xs">
            <span className="truncate">{userLabel}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[260px]" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuário..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum usuário</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => { onChange({ ...value, userId: null }); setUserOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value.userId ? 'opacity-100' : 'opacity-0')} />
                  Todos os usuários
                </CommandItem>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.name}
                    onSelect={() => { onChange({ ...value, userId: u.id }); setUserOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value.userId === u.id ? 'opacity-100' : 'opacity-0')} />
                    {u.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
