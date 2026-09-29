import { Pencil, LayoutTemplate, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
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
              'relative flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors duration-200',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5 transition-transform duration-300', active && 'scale-110')} />
            {m.label}
            {active && (
              <motion.span layoutId="creation-mode-underline" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
