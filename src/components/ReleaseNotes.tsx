import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Megaphone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  KIND_LABELS, LATEST, RELEASES, formatReleaseDate, hasUnseen, markPopupShown, markSeen, shouldPopup, type NoteKind,
} from '@/lib/releaseNotes';

interface Ctx { open: () => void; unseen: boolean }
const ReleaseNotesContext = createContext<Ctx>({ open: () => undefined, unseen: false });

/** Wraps the app: owns the side panel and the once-per-release pop-up. */
export function ReleaseNotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [panel, setPanel] = useState(false);
  const [popup, setPopup] = useState(false);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!user) { setUnseen(false); return; }
    setUnseen(hasUnseen(user.id));
    const inApp = !/^\/(auth|pending-approval)/.test(pathname);
    if (inApp && shouldPopup(user.id)) {
      const t = setTimeout(() => setPopup(true), 900); // after the page has settled
      return () => clearTimeout(t);
    }
  }, [user, pathname]);

  const open = useCallback(() => {
    setPopup(false);
    setPanel(true);
    if (user) { markSeen(user.id); markPopupShown(user.id); setUnseen(false); }
  }, [user]);

  const closePopup = () => {
    setPopup(false);
    if (user) markPopupShown(user.id);
  };

  return (
    <ReleaseNotesContext.Provider value={{ open, unseen }}>
      {children}
      <ReleaseNotesPanel open={panel} onOpenChange={setPanel} />
      {LATEST && (
        <Dialog open={popup} onOpenChange={(o) => { if (!o) closePopup(); }}>
          <DialogContent className="max-w-md overflow-hidden p-0">
            <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-primary/15 via-card to-card">
              <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Versão {LATEST.version}
              </span>
              <DialogHeader className="relative mt-3 text-left">
                <DialogTitle className="text-xl leading-snug">{LATEST.title}</DialogTitle>
                <DialogDescription>{formatReleaseDate(LATEST.date)}</DialogDescription>
              </DialogHeader>
            </div>
            <ul className="px-6 py-4 space-y-3 stagger">
              {LATEST.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-none" />
                  {h}
                </li>
              ))}
            </ul>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <Button variant="ghost" onClick={closePopup}>Agora não</Button>
              <Button onClick={open} className="gap-1.5 btn-shine"><Megaphone className="h-4 w-4" /> Ver as notas de versão</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ReleaseNotesContext.Provider>
  );
}

export const useReleaseNotes = () => useContext(ReleaseNotesContext);

/** Header button; the yellow dot means there is a release the person hasn't opened yet. */
export function ReleaseNotesButton({ compact }: { compact?: boolean }) {
  const { open, unseen } = useReleaseNotes();
  return (
    <button onClick={open} title="Notas de versão"
      className="relative inline-flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
      <Megaphone className="h-4 w-4" />
      {!compact && <span className="hidden md:inline">Notas de versão</span>}
      {unseen && (
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      )}
    </button>
  );
}

const KIND_STYLE: Record<NoteKind, string> = {
  novo: 'bg-primary text-primary-foreground',
  melhoria: 'bg-sky-500/15 text-sky-400',
  correcao: 'bg-emerald-500/15 text-emerald-400',
  previa: 'bg-fuchsia-500/15 text-fuchsia-400',
};

function ReleaseNotesPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b text-left">
          <SheetTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Notas de versão</SheetTitle>
          <SheetDescription>O que mudou na plataforma — novidades, melhorias e correções.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-10">
          {RELEASES.map((r, ri) => (
            <article key={r.id} className="space-y-6">
              <div className="flex items-baseline gap-3">
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', ri === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>v{r.version}</span>
                <span className="text-xs text-muted-foreground">{formatReleaseDate(r.date)}</span>
              </div>
              <h3 className="text-lg font-bold leading-snug -mt-3">{r.title}</h3>
              {r.sections.map((s) => (
                <section key={s.title} className="space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{s.title}</h4>
                  <ul className="space-y-3">
                    {s.items.map((it) => (
                      <li key={it.title} className="flex gap-3">
                        <span className={cn('h-fit mt-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide whitespace-nowrap', KIND_STYLE[it.kind])}>{KIND_LABELS[it.kind]}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{it.title}</div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed">{it.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
