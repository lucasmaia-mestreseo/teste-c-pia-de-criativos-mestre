import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ClipboardCopy, ClipboardList, FileSpreadsheet, FileText, Link2, Loader2, MessageSquareQuote, PenLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  answerCount, briefingFromForm, briefingFromText, briefingQuestionsText, briefingsFromCsv, looksLikeFormCsv,
  MESTRE_BRIEFING_QUESTIONS, type Briefing,
} from '@/kv/briefing';
import { readPdf } from '@/kv/pdfTools';

interface Props {
  briefings: Briefing[];
  onChange: (b: Briefing[]) => void;
  notes: string;
  onNotesChange: (s: string) => void;
}

/** Other responses of a multi-row CSV, so the designer can switch rows. */
type Alternatives = Record<string, Briefing[]>;

/** Reads a briefing file: Forms CSV, PDF or text. Returns the briefings (first = newest) or throws. */
export async function readBriefingFile(file: File): Promise<Briefing[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdf = await readPdf(await file.arrayBuffer(), { maxRenderPages: 0 });
    if (!pdf.text.trim()) throw new Error('O PDF não tem texto selecionável (é uma imagem escaneada?).');
    return [briefingFromText(pdf.text, file.name)];
  }
  const text = await file.text();
  if (lower.endsWith('.csv') || looksLikeFormCsv(text)) {
    const list = briefingsFromCsv(text, file.name);
    if (!list.length) throw new Error('Não encontramos respostas nesse CSV.');
    return list;
  }
  return [briefingFromText(text, file.name)];
}

export default function KvBriefingCard({ briefings, onChange, notes, onNotesChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [alts, setAlts] = useState<Alternatives>({});
  const [notesOpen, setNotesOpen] = useState(!!notes);

  const addFiles = async (files: FileList) => {
    setLoading(true);
    const added: Briefing[] = [];
    for (const f of Array.from(files)) {
      try {
        const list = await readBriefingFile(f);
        added.push(list[0]);
        if (list.length > 1) {
          setAlts((a) => ({ ...a, [list[0].id]: list }));
          toast.info(`${list.length} respostas no arquivo`, { description: 'Usamos a mais recente. Troque no seletor do card, se precisar.' });
        }
      } catch (e) {
        toast.error(`Não foi possível ler ${f.name}`, { description: e instanceof Error ? e.message : undefined });
      }
    }
    setLoading(false);
    if (added.length) onChange([...briefings, ...added]);
  };

  const swapRow = (current: Briefing, next: Briefing) => {
    const list = alts[current.id];
    setAlts((a) => { const c = { ...a }; delete c[current.id]; c[next.id] = list; return c; });
    onChange(briefings.map((b) => (b.id === current.id ? next : b)));
  };

  const copyQuestions = async () => {
    await navigator.clipboard.writeText(briefingQuestionsText());
    toast.success('Perguntas copiadas', { description: 'Cole num e-mail ou num Google Forms para o cliente responder.' });
  };

  const empty = briefings.length === 0;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-5 pb-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-none">
          <MessageSquareQuote className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold">Briefing do cliente</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            As respostas decidem a forma do manual: que páginas entram, o que é criado sob medida e como cada orientação é escrita.
          </p>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple className="hidden" accept=".csv,.pdf,.txt,.md"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />

      {empty ? (
        <div className="px-5 pb-5 space-y-2">
          <div className="grid gap-2 stagger">
            <SourceButton icon={FileSpreadsheet} title="Respostas do Google Forms" hint="Exporte as respostas em .csv e envie aqui" onClick={() => inputRef.current?.click()} busy={loading} />
            <SourceButton icon={FileText} title="Briefing em PDF ou texto" hint="Documento, e-mail ou ata de reunião" onClick={() => inputRef.current?.click()} busy={loading} />
            <SourceButton icon={PenLine} title="Preencher aqui" hint="As mesmas perguntas do formulário da Mestre" onClick={() => setFormOpen(true)} />
          </div>
          <button onClick={copyQuestions} className="w-full text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 pt-1">
            <ClipboardCopy className="h-3 w-3" /> Copiar as perguntas para enviar ao cliente
          </button>
        </div>
      ) : (
        <div className="px-5 pb-4 space-y-3">
          {briefings.map((b) => (
            <BriefingView key={b.id} b={b} alternatives={alts[b.id]} onSwap={(n) => swapRow(b, n)}
              onRemove={() => onChange(briefings.filter((x) => x.id !== b.id))} />
          ))}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => inputRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />} Outro arquivo
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => setFormOpen(true)}>
              <PenLine className="h-3 w-3" /> Complementar aqui
            </Button>
          </div>
        </div>
      )}

      {/* Agency notes */}
      <div className="border-t">
        <button onClick={() => setNotesOpen((v) => !v)} className="w-full px-5 py-3 flex items-center gap-2 text-xs font-medium hover:bg-secondary/40 transition-colors">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          Observações da agência
          {notes.trim() && !notesOpen && <span className="text-muted-foreground font-normal truncate">· {notes.trim().slice(0, 40)}</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform duration-300', notesOpen && 'rotate-180')} />
        </button>
        <div className={cn('grid transition-all duration-300 ease-out', notesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden">
            <div className="px-5 pb-4 space-y-1.5">
              <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)}
                placeholder={'Ex.: "Laranja com neutros; vermelho nunca." · "Cliente aprovou só estas peças." · "Não fazem landing pages."'}
                className="min-h-[90px] text-xs bg-secondary resize-none" />
              <p className="text-[10px] text-muted-foreground">O que a equipe já sabe e não está no briefing. A IA segue à risca.</p>
            </div>
          </div>
        </div>
      </div>

      <BriefingFormDialog open={formOpen} onOpenChange={setFormOpen}
        onSave={(answers) => {
          const b = briefingFromForm(answers);
          if (!b.respostas.length) { toast.info('Nenhuma resposta preenchida'); return; }
          onChange([...briefings, b]);
          setFormOpen(false);
          toast.success(`Briefing com ${b.respostas.length} resposta(s) adicionado`);
        }} />
    </div>
  );
}

function SourceButton({ icon: Icon, title, hint, onClick, busy }: { icon: typeof FileText; title: string; hint: string; onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="group w-full flex items-center gap-3 rounded-xl border bg-secondary/40 px-3.5 py-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-secondary hover:-translate-y-px disabled:opacity-60">
      <span className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors flex-none">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function BriefingView({ b, alternatives, onSwap, onRemove }: { b: Briefing; alternatives?: Briefing[]; onSwap: (b: Briefing) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const shown = open ? b.respostas : b.respostas.slice(0, 3);
  return (
    <div className="rounded-xl border bg-background/40 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b">
        <FileSpreadsheet className="h-3.5 w-3.5 text-primary flex-none" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate" title={b.origem}>{b.origem}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {[b.respondente, b.data?.split(' ')[0], `${answerCount(b)} resposta(s)`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      {alternatives && alternatives.length > 1 && (
        <div className="px-3.5 pt-2.5">
          <Select value={b.id} onValueChange={(id) => { const n = alternatives.find((x) => x.id === id); if (n) onSwap(n); }}>
            <SelectTrigger className="h-7 text-[11px] bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              {alternatives.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">{[a.respondente || 'Resposta', a.data?.split(' ')[0]].filter(Boolean).join(' · ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {b.respostas.length ? (
        <div className="px-3.5 py-2.5 space-y-2.5">
          {shown.map((a, i) => (
            <div key={i} className="text-[11px] leading-snug">
              <div className="text-muted-foreground line-clamp-2">{a.pergunta}</div>
              <div className="font-medium mt-0.5 whitespace-pre-line">{a.resposta}</div>
            </div>
          ))}
          {b.respostas.length > 3 && (
            <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-primary hover:underline">
              {open ? 'Mostrar menos' : `Ver todas as ${b.respostas.length} respostas`}
            </button>
          )}
        </div>
      ) : (
        <p className="px-3.5 py-2.5 text-[11px] text-muted-foreground line-clamp-4 whitespace-pre-line">{b.texto}</p>
      )}

      {b.anexos.length > 0 && (
        <div className="mx-3.5 mb-3 rounded-lg bg-amber-500/10 text-amber-500 px-2.5 py-2 text-[11px] flex gap-2">
          <Link2 className="h-3.5 w-3.5 flex-none mt-0.5" />
          <span>
            {b.anexos.length} anexo(s) em link (Google Drive). A plataforma não abre o Drive: baixe os arquivos e solte em <b>Materiais da marca</b>.
          </span>
        </div>
      )}
    </div>
  );
}

function BriefingFormDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (answers: string[]) => void }) {
  const [answers, setAnswers] = useState<string[]>(() => MESTRE_BRIEFING_QUESTIONS.map(() => ''));
  const filled = answers.filter((a) => a.trim()).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Briefing de criação</DialogTitle>
          <DialogDescription>As mesmas perguntas do formulário que a Mestre envia ao cliente. Preencha o que souber — pode deixar em branco.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 py-1">
          {MESTRE_BRIEFING_QUESTIONS.map((q, i) => (
            <label key={i} className="block space-y-1.5">
              <span className="text-xs font-medium flex gap-2">
                <span className={cn('h-4 w-4 rounded-full text-[9px] flex items-center justify-center flex-none mt-px transition-colors', answers[i].trim() ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
                {q}
              </span>
              <Textarea value={answers[i]} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-[56px] text-xs bg-secondary resize-y" />
            </label>
          ))}
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">{filled} de {MESTRE_BRIEFING_QUESTIONS.length} respondidas</span>
          <Button onClick={() => onSave(answers)} disabled={!filled}>Usar este briefing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
