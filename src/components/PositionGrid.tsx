import { cn } from '@/lib/utils';

export type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center-center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

const POSITIONS: Position[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center-center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

interface PositionGridProps {
  value: Position | null;
  onChange: (pos: Position | null) => void;
  label?: string;
}

export default function PositionGrid({ value, onChange, label }: PositionGridProps) {
  return (
    <div className="space-y-1">
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
      <div className="grid grid-cols-3 gap-1 w-fit">
        {POSITIONS.map((pos) => {
          const active = value === pos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => onChange(active ? null : pos)}
              className={cn(
                'w-7 h-7 rounded-sm border transition-colors flex items-center justify-center',
                active
                  ? 'bg-primary border-primary'
                  : 'bg-secondary border-border hover:border-primary/50'
              )}
              title={pos}
            >
              <span
                className={cn(
                  'block w-2 h-2 rounded-full',
                  active ? 'bg-primary-foreground' : 'bg-muted-foreground/40'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
