import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, ClipboardCopy, Lock, MinusCircle, PenLine, Plus, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandTokens } from '@/kv/tokens';
import {
  LAYOUT_LABELS, TEMPLATE_PAGES, emptyPlan, isIncluded, outline, templatePage,
  type ChapterId, type CoverageStatus, type CustomLayout, type CustomPage, type ManualPlan, type OutlineEntry,
} from '@/kv/structure';

/* ═══════════════════════════ Estratégia ═══════════════════════════ */

const STATUS: Record<CoverageStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  aplicado: { label: 'Aplicado', icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-500/10' },
  parcial: { label: 'Parcial', icon: CircleDashed, cls: 'text-amber-500 bg-amber-500/10' },
  sem_acao: { label: 'Sem mudança', icon: MinusCircle, cls: 'text-muted-foreground bg-secondary' },
};

export function StrategyView({ plan, onChange, onJump, onReplan, replanning }: {
  plan: ManualPlan;
  onChange: (p: ManualPlan) => void;
  onJump: (pageKey: string) => void;
  onReplan: () => void;
  replanning: boolean;
}) {
  const d = plan.diagnostico;
  const set = (fn: (p: ManualPlan) => void) => { const n = structuredClone(plan); fn(n); onChange(n); };
  const counts = useMemo(() => {
    const c = { aplicado: 0, parcial: 0, sem_acao: 0 };
    plan.cobertura.forEach((x) => { c[x.status]++; });
    return c;
  }, [plan.cobertura]);
  const total = plan.cobertura.length;
  const entries = useMemo(() => outline(plan), [plan]);
  const titleOf = (key: string) => entries.find((e) => e.key === key)?.titulo ?? templatePage(key)?.titulo ?? (key === 'contexto' ? 'Contexto do briefing' : key);

  const copyPendencias = async () => {
    await navigator.clipboard.writeText(plan.pendencias.map((p, i) => `${i + 1}. ${p}`).join('\n'));
    toast.success('Pendências copiadas para enviar ao cliente');
  };

  return (
    <div className="grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
      {/* Diagnóstico */}
      <div className="space-y-4 xl:sticky xl:top-4">
        <Card title="O que o briefing diz" subtitle="Vira a página “Contexto do briefing”. Ajuste as palavras se precisar."
          action={<Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={onReplan} disabled={replanning}>
            <RefreshCw className={cn('h-3 w-3', replanning && 'animate-spin')} /> Refazer com IA
          </Button>}>
          <div className="rounded-xl bg-primary/[0.07] border border-primary/20 p-3.5">
            <Label>O problema que resolvemos</Label>
            <Textarea value={d.problema} onChange={(e) => set((p) => { p.diagnostico.problema = e.target.value; })}
              className="min-h-[56px] text-sm font-medium bg-transparent border-0 p-0 focus-visible:ring-0 resize-none" />
          </div>
          <div>
            <Label>Quem precisamos impactar</Label>
            <Textarea value={d.persona} onChange={(e) => set((p) => { p.diagnostico.persona = e.target.value; })} className="min-h-[48px] text-xs bg-secondary resize-none" />
          </div>
          <div>
            <Label>Tom de voz</Label>
            <Textarea value={d.tomDeVoz} onChange={(e) => set((p) => { p.diagnostico.tomDeVoz = e.target.value; })} className="min-h-[44px] text-xs bg-secondary resize-none" />
          </div>
          <ChipsField label="Atributos da linguagem visual" items={d.atributos} onChange={(v) => set((p) => { p.diagnostico.atributos = v; })} />
          <ChipsField label="A marca não quer parecer" items={d.naoTransmitir} negative onChange={(v) => set((p) => { p.diagnostico.naoTransmitir = v; })} />
          <LinesField label="Restrições" items={d.restricoes} onChange={(v) => set((p) => { p.diagnostico.restricoes = v; })} />
        </Card>
      </div>

      {/* Cobertura */}
      <div className="space-y-4">
        <Card title="Cada resposta, no manual" subtitle="Onde cada resposta do cliente foi aplicada. Clique numa página para vê-la na estrutura.">
          {total > 0 && (
            <div className="space-y-2">
              <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                {(['aplicado', 'parcial', 'sem_acao'] as const).map((s) => (
                  <div key={s} style={{ width: `${(counts[s] / total) * 100}%` }}
                    className={cn('h-full transition-all duration-700 ease-out', s === 'aplicado' ? 'bg-emerald-500' : s === 'parcial' ? 'bg-amber-500' : 'bg-muted-foreground/30')} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span><b className="text-foreground">{counts.aplicado}</b> de {total} aplicadas</span>
                {counts.parcial > 0 && <span><b className="text-amber-500">{counts.parcial}</b> parciais</span>}
                {counts.sem_acao > 0 && <span><b className="text-foreground">{counts.sem_acao}</b> sem mudança</span>}
              </div>
            </div>
          )}
          <div className="space-y-2 stagger">
            {plan.cobertura.map((c, i) => {
              const st = STATUS[c.status];
              const Icon = st.icon;
              return (
                <div key={i} className="rounded-xl border bg-background/40 p-3 space-y-1.5 transition-colors hover:border-primary/25">
                  <div className="flex items-start gap-2">
                    <span className={cn('flex-none inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', st.cls)}>
                      <Icon className="h-3 w-3" /> {st.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{c.pergunta}</span>
                  </div>
                  <p className="text-xs font-medium leading-snug">“{c.resposta}”</p>
                  <p className="text-[11px] text-muted-foreground leading-snug flex gap-1.5"><ArrowRight className="h-3 w-3 flex-none mt-0.5 text-primary" />{c.aplicacao}</p>
                  {c.paginas.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {c.paginas.map((k) => (
                        <button key={k} onClick={() => onJump(k)}
                          className="text-[10px] rounded-md border px-1.5 py-0.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                          {titleOf(k)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!plan.cobertura.length && <p className="text-xs text-muted-foreground">Sem respostas mapeadas.</p>}
          </div>
        </Card>

        {plan.pendencias.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 animate-in fade-in duration-500">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-amber-500 flex-1">Levar de volta ao cliente</h3>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={copyPendencias}><ClipboardCopy className="h-3 w-3" /> Copiar</Button>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">{plan.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Estrutura ═══════════════════════════ */

const CHAPTERS: { id: ChapterId | null; label: string }[] = [
  { id: null, label: 'Abertura' },
  { id: 'estrategia', label: 'Estratégia de comunicação' },
  { id: 'marca', label: 'Elementos da marca' },
  { id: 'banners', label: 'Banners' },
  { id: 'lp', label: 'Landing pages' },
];

export function StructureView({ plan, onChange, tokens, highlight, canPlan, onPlan, planning }: {
  plan: ManualPlan | null;
  onChange: (p: ManualPlan) => void;
  tokens: BrandTokens;
  highlight: string | null;
  canPlan: boolean;
  onPlan: () => void;
  planning: boolean;
}) {
  const p = plan ?? emptyPlan();
  const entries = useMemo(() => outline(plan), [plan]);
  const [editing, setEditing] = useState<CustomPage | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const set = (fn: (d: ManualPlan) => void) => { const n = structuredClone(p); fn(n); onChange(n); };

  const toggle = (id: string) => set((d) => {
    const cur = isIncluded(d, id);
    const row = d.paginas.find((x) => x.id === id);
    if (row) row.incluir = !cur;
    else d.paginas.push({ id, incluir: !cur, motivo: '' });
  });

  const removed = TEMPLATE_PAGES.filter((t) => !entries.some((e) => e.key === t.id));
  const extrasCount = entries.filter((e) => e.tipo === 'extra' || e.tipo === 'contexto').length;
  const noted = new Set(p.notas.map((n) => n.id));

  return (
    <div className="space-y-5">
      {/* summary + legend */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-secondary/40 p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stat value={entries.length} label="páginas no manual" />
        <Stat value={extrasCount} label="sob medida" accent />
        <Stat value={p.notas.length} label="orientações reescritas" />
        <Stat value={removed.length} label="do padrão fora" muted />
        <div className="flex-1" />
        {canPlan && !plan?.cobertura.length && (
          <Button size="sm" onClick={onPlan} disabled={planning} className="gap-1.5 btn-shine">
            {planning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Moldar pelo briefing
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(newCustomPage(entries))}>
          <Plus className="h-3.5 w-3.5" /> Página sob medida
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2 px-1">
        Clique numa página do padrão para tirar ou devolver ao manual. As páginas sob medida abrem para edição. O sumário e a numeração se refazem sozinhos.
      </p>

      {CHAPTERS.map((ch) => {
        const inChapter = entries.filter((e) => e.capitulo === ch.id);
        const out = TEMPLATE_PAGES.filter((t) => t.capitulo === ch.id && !entries.some((e) => e.key === t.id));
        if (!inChapter.length && !out.length) return null;
        return (
          <section key={String(ch.id)} className="space-y-2.5 animate-in fade-in slide-in-from-bottom-1 duration-500">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-bold">{ch.id === 'estrategia' ? p.estrategia.titulo : ch.label}</h3>
              <span className="text-[11px] text-muted-foreground">{inChapter.length} página(s){out.length ? ` · ${out.length} fora` : ''}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 gap-3">
              {[...inChapter.map((e) => ({ e, off: false })), ...out.map((t) => ({ e: { key: t.id, titulo: t.titulo, tipo: t.tipo, capitulo: t.capitulo, template: t, numero: 0 } as OutlineEntry, off: true }))]
                .map(({ e, off }) => (
                  <PageThumb key={e.key} e={e} off={off} tokens={tokens} highlighted={highlight === e.key}
                    note={noted.has(e.key)}
                    motivo={p.paginas.find((x) => x.id === e.key)?.motivo}
                    onClick={() => {
                      if (e.extra) setEditing(e.extra);
                      else if (e.template && !e.template.essencial && e.template.tipo !== 'sumario') toggle(e.key);
                    }}
                    onEditNote={e.template?.nota ? () => setNoteFor(e.key) : undefined} />
                ))}
            </div>
          </section>
        );
      })}

      {editing && <CustomPageDialog key={editing.id} page={editing} entries={entries} onClose={() => setEditing(null)}
        onSave={(pg) => set((d) => {
          const i = d.extras.findIndex((x) => x.id === pg.id);
          if (i >= 0) d.extras[i] = pg; else d.extras.push(pg);
          if (pg.depoisDe === 'estrategia' || entries.some((e) => e.key === pg.depoisDe && e.capitulo === 'estrategia')) d.estrategia.incluir = true;
        })}
        onDelete={(id) => set((d) => {
          d.extras = d.extras.filter((x) => x.id !== id);
          d.extras.forEach((x) => { if (x.depoisDe === id) x.depoisDe = 'estrategia'; });
        })} />}

      <NoteDialog pageId={noteFor} plan={p} onClose={() => setNoteFor(null)}
        onSave={(id, texto) => set((d) => {
          d.notas = d.notas.filter((n) => n.id !== id);
          if (texto.trim()) d.notas.push({ id, texto: texto.trim() });
        })} />
    </div>
  );
}

function Stat({ value, label, accent, muted }: { value: number; label: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn('text-2xl font-bold tabular-nums transition-all', accent ? 'text-primary' : muted ? 'text-muted-foreground' : 'text-foreground')}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** A 16:9 miniature of a page, tinted with the brand colors. */
function PageThumb({ e, off, tokens, highlighted, note, motivo, onClick, onEditNote }: {
  e: OutlineEntry; off: boolean; tokens: BrandTokens; highlighted: boolean; note: boolean; motivo?: string;
  onClick: () => void; onEditNote?: () => void;
}) {
  const locked = !!e.template && (e.template.essencial || e.template.tipo === 'sumario');
  const custom = e.tipo === 'extra' || e.tipo === 'contexto' || e.key === 'estrategia';
  const isCover = e.tipo === 'capa';
  const isDivider = e.tipo === 'divisor' || e.tipo === 'subdivisor';
  const bg = isCover ? `linear-gradient(135deg, ${tokens.brand950}, ${tokens.brand900} 60%, ${tokens.brand700})` : isDivider ? tokens.brand050 : '#FBFBFB';
  return (
    <div className="group relative">
      <button onClick={onClick} disabled={locked && !custom} title={motivo || (locked ? 'Página essencial' : off ? 'Clique para devolver ao manual' : custom ? 'Editar' : 'Clique para tirar do manual')}
        className={cn(
          'relative w-full aspect-video rounded-lg overflow-hidden border text-left transition-all duration-300 ease-out',
          off ? 'opacity-40 border-dashed grayscale hover:opacity-70' : 'shadow-sm hover:-translate-y-0.5 hover:shadow-lg',
          custom && !off && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
          highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse',
          locked && !custom ? 'cursor-default' : 'cursor-pointer',
        )}
        style={{ background: bg }}>
        {/* miniature: header bar, a drawing of what the page shows, footer band */}
        {!isCover && !isDivider && (
          <div className="absolute inset-0 pt-[7%] px-[8%] flex flex-col gap-[5%]">
            <div className="flex items-center gap-1"><span className="w-[3px] h-2.5 rounded-sm" style={{ background: tokens.brand600 }} /><span className="h-1.5 w-1/2 rounded-full bg-black/15" /></div>
            <div className="flex-1 min-h-0"><MiniGlyph e={e} tk={tokens} /></div>
            <div className="h-[13%] -mx-[8%] bg-black/[0.05]" />
          </div>
        )}
        {isDivider && (
          <div className="absolute inset-0 flex flex-col justify-center px-[10%] gap-1.5">
            <span className="h-2 w-1/2 rounded-full" style={{ background: tokens.brand900 }} />
            <span className="h-1 w-2/3 rounded-full bg-black/10" />
            <span className="h-1 w-1/2 rounded-full bg-black/10" />
          </div>
        )}
        {isCover && <div className="absolute inset-0 flex items-center justify-center"><span className="h-1.5 w-1/3 rounded-full bg-white/70" /></div>}
        {e.numero > 0 && (
          <span className="absolute bottom-1 right-1.5 text-[9px] font-bold tabular-nums" style={{ color: isCover ? '#fff' : tokens.brand900 }}>{String(e.numero).padStart(2, '0')}</span>
        )}
        {custom && !off && <span className="absolute top-1 left-1 rounded bg-primary text-primary-foreground text-[8px] font-bold px-1 py-px uppercase tracking-wide">sob medida</span>}
        {locked && !custom && <Lock className="absolute top-1 right-1 h-2.5 w-2.5 text-black/30" />}
      </button>
      <div className="mt-1 flex items-start gap-1">
        <span className={cn('text-[10.5px] leading-tight flex-1 line-clamp-2', off ? 'text-muted-foreground line-through' : 'text-foreground')}>{e.titulo}</span>
        {onEditNote && !off && (
          <button onClick={onEditNote} title={note ? 'Orientação reescrita para o cliente — editar' : 'Reescrever a orientação de uso'}
            className={cn('flex-none rounded p-0.5 transition-colors', note ? 'text-primary' : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-primary')}>
            <PenLine className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** What each page shows, drawn with the brand colors — so the structure reads at a glance. */
function MiniGlyph({ e, tk }: { e: OutlineEntry; tk: BrandTokens }) {
  const id = e.key;
  const logo = (color: string, w = '46%') => (
    <span className="flex items-center gap-[3px]" style={{ width: w }}>
      <span className="aspect-square h-2.5 rounded-[2px]" style={{ background: tk.accent700 }} />
      <span className="h-1.5 flex-1 rounded-full" style={{ background: color }} />
    </span>
  );
  const box = 'rounded-[3px] flex items-center justify-center';
  const layout = e.extra?.layout ?? (e.tipo === 'contexto' ? 'contexto' : null);

  if (layout) {
    switch (layout) {
      case 'contexto':
        return <div className="h-full grid grid-cols-[1.1fr_1fr] gap-1"><span className="rounded-[3px] border-l-2" style={{ background: tk.brand900, borderColor: tk.accent700 }} />
          <div className="flex flex-col gap-1 justify-center">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 rounded-full border" style={{ borderColor: tk.brand600, width: `${80 - i * 18}%` }} />)}</div></div>;
      case 'persona':
        return <div className="h-full grid grid-cols-2 gap-1">{[0, 1].map((i) => <div key={i} className="rounded-[3px] border border-black/10 overflow-hidden flex flex-col"><span className="h-[30%]" style={{ background: tk.brand900 }} /><span className="m-1 h-1 w-2/3 rounded-full bg-black/10" /><span className="mx-1 h-1 w-1/2 rounded-full bg-black/10" /></div>)}</div>;
      case 'checklist':
        return <div className="h-full grid grid-cols-2 gap-x-1.5 content-center gap-y-1">{[0, 1, 2, 3].map((i) => <span key={i} className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] border-[1.5px]" style={{ borderColor: tk.brand600 }} /><span className="h-1 flex-1 rounded-full bg-black/15" /></span>)}</div>;
      case 'tabela':
        return <div className="h-full flex flex-col gap-[3px] justify-center">{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1.5 rounded-[2px]', i === 0 ? 'bg-black/15' : 'bg-black/[0.06]')} />)}</div>;
      case 'fazer_nao_fazer':
        return <div className="h-full grid grid-cols-2 gap-1">{[tk.brand600, tk.accent700].map((c, i) => <div key={i} className="flex flex-col gap-1 justify-center"><span className="h-1.5 rounded-[2px] border-l-2 bg-black/10" style={{ borderColor: c }} />{[0, 1].map((j) => <span key={j} className="h-1 w-4/5 rounded-full bg-black/10" />)}</div>)}</div>;
      case 'texto':
        return <div className="h-full grid grid-cols-2 gap-1.5 content-center">{[0, 1].map((i) => <div key={i} className="flex flex-col gap-1"><span className="h-1.5 w-2/3 rounded-full" style={{ background: tk.brand900 }} />{[0, 1].map((j) => <span key={j} className="h-1 rounded-full bg-black/10" />)}</div>)}</div>;
      default:
        return <div className="h-full grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => <span key={i} className="rounded-[2px] border border-black/10 border-t-2 bg-white" style={{ borderTopColor: i === 0 ? tk.accent700 : tk.brand600 }} />)}</div>;
    }
  }

  if (/^cores/.test(id)) {
    const chips = id === 'cores-primarias' ? [tk.brand900, tk.brand600, tk.accent700, tk.brand100] : [tk.brand700, tk.brand500, tk.brand300, tk.brand050];
    return <div className="h-full grid grid-cols-4 gap-1 items-center">{chips.map((c, i) => <span key={i} className="h-3/5 rounded-[2px] border border-black/5" style={{ background: c }} />)}</div>;
  }
  if (/(^|-)tipo/.test(id)) { // tipografia, banners-tipo-*, lp-tipo-* (not "logotipo")
    return <div className="h-full flex items-center gap-2 px-1"><span className="font-bold leading-none text-[15px]" style={{ color: tk.brand900 }}>Aa</span>
      <div className="flex-1 flex flex-col gap-1">{[90, 70, 50].map((w) => <span key={w} className="h-1 rounded-full bg-black/10" style={{ width: `${w}%` }} />)}</div></div>;
  }
  if (id === 'cta' || id === 'lp-cta') {
    return <div className="h-full flex items-center justify-center gap-1.5"><span className="h-3 w-1/3 rounded-[3px]" style={{ background: tk.accent700 }} /><span className="h-3 w-1/4 rounded-[3px] border" style={{ borderColor: tk.brand900 }} /></div>;
  }
  if (id === 'logo-usos-indevidos') {
    return <div className="h-full grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cn(box, 'relative border border-black/10')}>{logo(tk.brand900, '70%')}<span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full" style={{ background: tk.accent700 }} /></span>)}</div>;
  }
  if (id === 'logo-protecao') {
    return <div className="h-full flex items-center justify-center"><span className="border border-dashed px-2 py-1.5" style={{ borderColor: tk.brand600 }}>{logo(tk.brand900, '44px')}</span></div>;
  }
  if (/logo|logotipo/.test(id)) {
    return <div className="h-full grid grid-cols-2 gap-1"><span className={cn(box, 'bg-white border border-black/10')}>{logo(tk.brand900)}</span><span className={box} style={{ background: tk.brand900 }}>{logo('#fff')}</span></div>;
  }
  if (id === 'imagens-regras') {
    return <div className="h-full grid grid-cols-2 gap-1">{[tk.brand600, tk.accent700].map((c, i) => <div key={i} className="flex flex-col gap-1 justify-center"><span className="h-1.5 rounded-[2px] border-l-2 bg-black/10" style={{ borderColor: c }} />{[0, 1].map((j) => <span key={j} className="h-1 w-4/5 rounded-full bg-black/10" />)}</div>)}</div>;
  }
  if (/imagens|exemplo-topo|continuacao/.test(id)) {
    return <div className="h-full grid grid-cols-2 gap-1">{[0, 1].map((i) => <span key={i} className="rounded-[2px] relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${tk.brand100}, ${tk.brand500})` }}><span className="absolute bottom-0 left-[15%] w-0 h-0 border-l-[8px] border-r-[8px] border-b-[10px] border-transparent" style={{ borderBottomColor: tk.brand900 }} /></span>)}</div>;
  }
  if (/margens/.test(id)) {
    return <div className="h-full flex items-center justify-center gap-1.5">{['1/1', '9/16', '1.91/1'].map((r) => <span key={r} className="h-4/5 bg-black/[0.07] p-[3px]" style={{ aspectRatio: r.replace('/', ' / ') }}><span className="block h-full w-full border border-dashed" style={{ borderColor: tk.brand600 }} /></span>)}</div>;
  }
  if (/criativo|banners-exemplos-formatos/.test(id)) {
    return <div className="h-full flex items-center justify-center gap-1.5">{[['1/1', tk.brand900], ['9/16', tk.brand050], ['1.91/1', tk.brand600]].map(([r, c]) => <span key={r} className="h-4/5 rounded-[2px] border border-black/10 flex items-end justify-center pb-[3px]" style={{ aspectRatio: r.replace('/', ' / '), background: c }}><span className="h-1 w-1/2 rounded-full" style={{ background: tk.accent700 }} /></span>)}</div>;
  }
  return <div className="h-full grid grid-cols-2 gap-1"><span className="rounded-[2px] bg-black/[0.06]" /><span className="rounded-[2px] bg-black/[0.06]" /></div>;
}

function newCustomPage(entries: OutlineEntry[]): CustomPage {
  let n = 1;
  while (entries.some((e) => e.key === `pagina-${n}`)) n++;
  return {
    id: `pagina-${n}`, titulo: '', depoisDe: 'estrategia', layout: 'cards', intro: '',
    itens: [{ titulo: '', texto: '', lista: [] }, { titulo: '', texto: '', lista: [] }, { titulo: '', texto: '', lista: [] }],
    colunas: [], fazer: [], naoFazer: [], nota: '',
  };
}

/** Mounted only while editing (keyed by page id), so the draft starts fresh each time. */
function CustomPageDialog({ page, entries, onClose, onSave, onDelete }: {
  page: CustomPage; entries: OutlineEntry[]; onClose: () => void; onSave: (p: CustomPage) => void; onDelete: (id: string) => void;
}) {
  const [d, setD] = useState<CustomPage>(() => structuredClone(page));
  const upd = (fn: (x: CustomPage) => void) => setD((x) => { const n = structuredClone(x); fn(n); return n; });
  const isNew = !entries.some((e) => e.key === page.id);
  const anchors = entries.filter((e) => e.key !== page.id && e.tipo !== 'capa');
  const needsItems = d.layout !== 'fazer_nao_fazer';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nova página sob medida' : 'Página sob medida'}</DialogTitle>
          <DialogDescription>Mesmo visual do manual, com o conteúdo que este cliente precisa.</DialogDescription>
        </DialogHeader>
        {(
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 py-1">
            <div className="grid sm:grid-cols-[1fr_180px] gap-3">
              <div><Label>Título</Label><Input value={d.titulo} onChange={(e) => upd((x) => { x.titulo = e.target.value; })} className="h-9 bg-secondary" placeholder="Ex.: Persona decisora" /></div>
              <div>
                <Label>Formato</Label>
                <Select value={d.layout} onValueChange={(v) => upd((x) => { x.layout = v as CustomLayout; })}>
                  <SelectTrigger className="h-9 bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(LAYOUT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Aparece depois de</Label>
              <Select value={d.depoisDe} onValueChange={(v) => upd((x) => { x.depoisDe = v; })}>
                <SelectTrigger className="h-9 bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estrategia">Abertura da estratégia</SelectItem>
                  {anchors.map((e) => <SelectItem key={e.key} value={e.key}>{String(e.numero).padStart(2, '0')} · {e.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Introdução</Label><Textarea value={d.intro} onChange={(e) => upd((x) => { x.intro = e.target.value; })} className="min-h-[60px] text-xs bg-secondary" /></div>

            {d.layout === 'tabela' && (
              <div><Label>Colunas (separadas por vírgula)</Label>
                <Input value={d.colunas.join(', ')} onChange={(e) => upd((x) => { x.colunas = e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3); })} className="h-8 text-xs bg-secondary" placeholder="Mensagem, Como mostrar, CTA" />
              </div>
            )}

            {d.layout === 'fazer_nao_fazer' ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <LinesField label="Fazer" items={d.fazer} onChange={(v) => upd((x) => { x.fazer = v; })} />
                <LinesField label="Não fazer" items={d.naoFazer} onChange={(v) => upd((x) => { x.naoFazer = v; })} />
              </div>
            ) : needsItems && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{d.layout === 'persona' ? 'Perfis' : d.layout === 'tabela' ? 'Linhas' : 'Itens'}</Label>
                  {d.itens.length < 6 && (
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => upd((x) => { x.itens.push({ titulo: '', texto: '', lista: [] }); })}><Plus className="h-3 w-3" /> item</Button>
                  )}
                </div>
                {d.itens.map((it, i) => (
                  <div key={i} className="rounded-lg border p-2.5 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex gap-2">
                      <Input value={it.titulo} onChange={(e) => upd((x) => { x.itens[i].titulo = e.target.value; })} className="h-8 text-xs bg-secondary font-semibold" placeholder="Título" />
                      <button onClick={() => upd((x) => { x.itens.splice(i, 1); })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <Textarea value={it.texto} onChange={(e) => upd((x) => { x.itens[i].texto = e.target.value; })} className="min-h-[44px] text-xs bg-secondary resize-none" placeholder="Texto" />
                    {d.layout !== 'checklist' && (
                      <Textarea value={it.lista.join('\n')} onChange={(e) => upd((x) => { x.itens[i].lista = e.target.value.split('\n').filter((s) => s.trim()).slice(0, 5); })}
                        className="min-h-[40px] text-[11px] bg-secondary resize-none" placeholder={d.layout === 'persona' ? 'O que precisa ver (um por linha)' : 'Tópicos (um por linha, opcional)'} />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div><Label>Orientações de uso (opcional)</Label><Textarea value={d.nota} onChange={(e) => upd((x) => { x.nota = e.target.value; })} className="min-h-[50px] text-xs bg-secondary" /></div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {!isNew ? (
            <Button variant="ghost" className="text-destructive gap-1.5" onClick={() => { onDelete(d.id); onClose(); }}><Trash2 className="h-3.5 w-3.5" /> Remover página</Button>
          ) : <span />}
          <Button disabled={!d.titulo.trim()} onClick={() => { onSave(d); onClose(); }} className="gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Salvar página</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ pageId, plan, onClose, onSave }: { pageId: string | null; plan: ManualPlan; onClose: () => void; onSave: (id: string, texto: string) => void }) {
  const [text, setText] = useState('');
  const [forId, setForId] = useState<string | null>(null);
  if (pageId && forId !== pageId) {
    setForId(pageId);
    setText(plan.notas.find((n) => n.id === pageId)?.texto ?? '');
  }
  const t = pageId ? templatePage(pageId) : null;
  return (
    <Dialog open={!!pageId} onOpenChange={(o) => { if (!o) { onClose(); setForId(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Orientação de uso · {t?.titulo}</DialogTitle>
          <DialogDescription>Substitui o texto padrão da página “{t?.titulo}”. Deixe vazio para manter o padrão. Use **negrito** para destacar.</DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[140px] text-sm bg-secondary" placeholder="Texto padrão do manual" />
        <DialogFooter>
          <Button onClick={() => { if (pageId) onSave(pageId, text); onClose(); setForId(null); }}>Salvar orientação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── small pieces ─── */

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{children}</div>;
}

function ChipsField({ label, items, onChange, negative }: { label: string; items: string[]; onChange: (v: string[]) => void; negative?: boolean }) {
  const [adding, setAdding] = useState('');
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={`${it}-${i}`} className={cn('group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium animate-in zoom-in-95 duration-200',
            negative ? 'border-rose-400/40 text-rose-400 line-through decoration-rose-400/60' : 'border-primary/40 text-primary bg-primary/5')}>
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity no-underline">×</button>
          </span>
        ))}
        <input value={adding} onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && adding.trim()) { onChange([...items, adding.trim()]); setAdding(''); } }}
          placeholder="+ adicionar" className="bg-transparent text-xs outline-none w-24 px-1 placeholder:text-muted-foreground/50" />
      </div>
    </div>
  );
}

function LinesField({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(items.join('\n'));
  const [src, setSrc] = useState(items);
  if (src !== items) { setSrc(items); setText(items.join('\n')); }
  return (
    <div>
      <Label>{label}</Label>
      <Textarea value={text} onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6))}
        className="min-h-[80px] text-xs bg-secondary" placeholder="Uma por linha" />
    </div>
  );
}
