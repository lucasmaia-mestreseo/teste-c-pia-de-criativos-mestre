import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, FileText, FileType2, FolderUp, ImageIcon, Loader2, Palette, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { loadMaterial, materialFromUrl, fontFamiliesFrom, type ImageRole, type Material } from '@/kv/pipeline';
import { looksLikeFormCsv, type Briefing } from '@/kv/briefing';
import KvBriefingCard, { readBriefingFile } from './KvBriefingCard';

const ROLE_LABELS: Record<ImageRole, string> = {
  auto: 'IA decide',
  logo: 'Logotipo',
  logo_tagline: 'Logo com slogan',
  simbolo: 'Símbolo',
  foto: 'Fotografia',
  peca: 'Peça / criativo',
};

interface Props {
  materials: Material[];
  onMaterialsChange: (m: Material[]) => void;
  briefings: Briefing[];
  onBriefingsChange: (b: Briefing[]) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  brandKit: { logo_url?: string | null; photos?: string[] | null; people_photos?: string[] | null; primary_color?: string | null } | null | undefined;
  onAnalyze: () => void;
  analyzing: boolean;
}

export default function KvMaterialsStep({ materials, onMaterialsChange, briefings, onBriefingsChange, notes, onNotesChange, brandKit, onAnalyze, analyzing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const added: Material[] = [];
    const newBriefings: Briefing[] = [];
    for (const f of Array.from(files)) {
      try {
        setLoading(`Lendo ${f.name}…`);
        // a Google Forms export dropped here is a briefing, not a brand material
        if (/\.csv$/i.test(f.name) && looksLikeFormCsv(await f.text())) {
          newBriefings.push((await readBriefingFile(f))[0]);
          continue;
        }
        added.push(await loadMaterial(f, (msg) => setLoading(`${f.name}: ${msg}`)));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Não foi possível ler ${f.name}`);
      }
    }
    setLoading(null);
    if (added.length) onMaterialsChange([...materials, ...added]);
    if (newBriefings.length) {
      onBriefingsChange([...briefings, ...newBriefings]);
      toast.success('Briefing reconhecido', { description: 'As respostas do formulário foram para o card de briefing.' });
    }
  };

  const importFromBrandKit = async () => {
    if (!brandKit) return;
    const added: Material[] = [];
    setLoading('Importando do Brand Kit…');
    try {
      if (brandKit.logo_url) added.push(await materialFromUrl(brandKit.logo_url, 'Logo do Brand Kit', 'logo'));
      for (const [i, url] of [...(brandKit.people_photos ?? []), ...(brandKit.photos ?? [])].slice(0, 4).entries()) {
        added.push(await materialFromUrl(url, `Foto do Brand Kit ${i + 1}`, 'foto'));
      }
    } catch {
      toast.error('Alguma imagem do Brand Kit não pôde ser carregada');
    }
    setLoading(null);
    if (added.length) {
      onMaterialsChange([...materials, ...added]);
      toast.success(`${added.length} arquivo(s) importado(s) do Brand Kit`);
    } else {
      toast.info('O Brand Kit deste projeto ainda não tem logo nem fotos');
    }
  };

  // MODO DEMO only (stripped from production builds: MODE is a build-time constant)
  const loadSamples = async () => {
    const { sampleBrandbook, sampleLogo, sampleBriefingCsv } = await import('@/demo/kvSamples');
    await addFiles([sampleBrandbook(), await sampleLogo(), sampleBriefingCsv()]);
  };

  const setRole = (id: string, role: ImageRole) =>
    onMaterialsChange(materials.map((m) => (m.id === id && m.kind === 'image' ? { ...m, role } : m)));
  const remove = (id: string) => onMaterialsChange(materials.filter((m) => m.id !== id));

  const fonts = fontFamiliesFrom(materials);
  const hasLogo = materials.some((m) => m.kind === 'image' && (m.role === 'logo' || m.role === 'auto'));
  const hasPdf = materials.some((m) => m.kind === 'pdf');
  const hasPhotos = materials.some((m) => m.kind === 'image' && (m.role === 'foto' || m.role === 'peca'));
  const canAnalyze = materials.length > 0 && !loading && !analyzing;
  const ready = [
    { ok: briefings.length > 0, label: 'Briefing', hint: 'molda a estrutura' },
    { ok: hasPdf, label: 'Brandbook', hint: 'cores e fontes oficiais' },
    { ok: hasLogo, label: 'Logotipo', hint: 'PNG, SVG ou JPG' },
    { ok: hasPhotos, label: 'Fotos ou peças', hint: 'imagens do manual' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
        <KvBriefingCard briefings={briefings} onChange={onBriefingsChange} notes={notes} onNotesChange={onNotesChange} />

        {/* Brand materials */}
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-none">
              <FolderUp className="h-[18px] w-[18px]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold">Materiais da marca</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Brandbook e apresentações em PDF, logotipo, peças já aprovadas e fotos. Quanto mais material, mais fiel o manual.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
            disabled={!!loading}
            className={cn(
              'w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center transition-all duration-300',
              materials.length ? 'py-5' : 'py-10',
              dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-secondary/40',
            )}
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className={cn('h-6 w-6 text-primary transition-transform duration-300', dragOver && '-translate-y-1')} />}
            <span className="text-sm font-semibold">{loading ?? (dragOver ? 'Pode soltar' : 'Solte os arquivos aqui ou clique para escolher')}</span>
            {!loading && <span className="text-[11px] text-muted-foreground">PDF · PNG · SVG · JPG · WEBP — o CSV do Forms vai direto para o briefing</span>}
          </button>
          <input ref={inputRef} type="file" multiple className="hidden"
            accept=".pdf,image/*,.svg,.txt,.md,.csv,.json"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />

          <div className="flex flex-wrap gap-2">
            {import.meta.env.MODE === 'demo' && materials.length === 0 && (
              <Button variant="secondary" size="sm" onClick={loadSamples} disabled={!!loading} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Usar materiais de exemplo (demo)
              </Button>
            )}
            {brandKit && (brandKit.logo_url || brandKit.photos?.length || brandKit.people_photos?.length) ? (
              <Button variant="outline" size="sm" onClick={importFromBrandKit} disabled={!!loading} className="gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Trazer logo e fotos do Brand Kit
              </Button>
            ) : null}
          </div>

          {materials.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {materials.map((m) => (
                <div key={m.id} className="rounded-xl border bg-background/40 overflow-hidden group card-hover animate-in fade-in zoom-in-95 duration-300">
                  {m.kind === 'image' && (
                    <div className="h-28 checkerboard flex items-center justify-center p-2">
                      <img src={m.thumb} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {m.kind === 'pdf' && (
                    <div className="h-28 bg-secondary/60 flex gap-1 p-2 overflow-hidden">
                      {m.pages.slice(0, 4).map((p) => <img key={p.number} src={p.thumb} alt="" className="h-full w-auto rounded-sm shadow transition-transform duration-300 group-hover:-translate-y-0.5" />)}
                    </div>
                  )}
                  {m.kind === 'text' && (
                    <div className="h-28 bg-secondary/60 p-3 text-[10px] text-muted-foreground overflow-hidden leading-snug whitespace-pre-wrap">{m.text.slice(0, 400)}</div>
                  )}
                  <div className="p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      {m.kind === 'pdf' ? <FileType2 className="h-3.5 w-3.5 text-primary flex-none" /> : m.kind === 'text' ? <FileText className="h-3.5 w-3.5 text-primary flex-none" /> : <ImageIcon className="h-3.5 w-3.5 text-primary flex-none" />}
                      <span className="text-xs font-medium truncate flex-1" title={m.name}>{m.name}</span>
                      <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-destructive transition" title="Remover">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {m.kind === 'image' && (
                      <Select value={m.role} onValueChange={(v) => setRole(m.id, v as ImageRole)}>
                        <SelectTrigger className="h-7 text-[11px] bg-secondary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {m.kind === 'pdf' && (
                      <p className="text-[10px] text-muted-foreground">
                        {m.pageCount} páginas · {m.fonts.length ? `${m.fonts.length} fonte(s) embutida(s)` : 'sem fontes embutidas'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {fonts.length > 0 && (
            <p className="text-[11px] text-muted-foreground">Fontes encontradas nos PDFs: <b className="text-foreground">{fonts.join(', ')}</b></p>
          )}
        </div>
      </div>

      {/* Readiness + action */}
      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gradient-to-t from-background via-background/95 to-background/0">
        <div className="glass rounded-2xl border px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3 shadow-2xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 min-w-0">
            {ready.map((r) => (
              <div key={r.label} className="flex items-center gap-2" title={r.hint}>
                <span className={cn('h-5 w-5 rounded-full flex items-center justify-center transition-all duration-500',
                  r.ok ? 'bg-primary text-primary-foreground scale-100' : 'border border-muted-foreground/30 scale-90')}>
                  {r.ok && <Check className="h-3 w-3 animate-in zoom-in duration-300" strokeWidth={3} />}
                </span>
                <span className={cn('text-xs transition-colors', r.ok ? 'text-foreground font-medium' : 'text-muted-foreground')}>{r.label}</span>
              </div>
            ))}
          </div>
          <Button onClick={onAnalyze} disabled={!canAnalyze} className="h-10 px-5 gap-2 font-semibold btn-shine">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? 'Lendo…' : briefings.length ? 'Ler briefing e materiais' : 'Ler materiais com IA'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          {materials.length === 0 ? 'Envie ao menos um material da marca para começar.' : 'Nada vai para o manual antes do seu OK na próxima etapa.'}
        </p>
      </div>
    </div>
  );
}
