import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Friendly empty state: icon in a soft brand halo, title, hint and optional action. */
export default function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative">
        <div aria-hidden className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative h-16 w-16 rounded-2xl border bg-card flex items-center justify-center shadow-lg">
          <Icon className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold mt-2">{title}</h3>
      {children && <div className="text-sm text-muted-foreground max-w-sm leading-relaxed">{children}</div>}
      {action}
    </div>
  );
}
