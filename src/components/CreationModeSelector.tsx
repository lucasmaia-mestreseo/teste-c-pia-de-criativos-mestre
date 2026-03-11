import { Pencil, LayoutTemplate, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CreationMode = 'free' | 'templates' | 'swipe';

interface CreationModeSelectorProps {
  mode: CreationMode;
  onChange: (mode: CreationMode) => void;
}

const MODES = [
  { id: 'free' as const, label: 'Prompt Livre', icon: Pencil },
  { id: 'templates' as const, label: 'Modelos', icon: LayoutTemplate },
  { id: 'swipe' as const, label: 'Swipe File', icon: FolderOpen },
];

export default function CreationModeSelector({ mode, onChange }: CreationModeSelectorProps) {
  return (
    <div className="flex border-b">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors border-b-2',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
