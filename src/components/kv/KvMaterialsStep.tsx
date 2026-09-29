import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ImageIcon, Loader2, Sparkles, Trash2, Upload, FileType2, Palette, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { loadMaterial, materialFromUrl, fontFamiliesFrom, type ImageRole, type Material } from '@/kv/pipeline';

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
  notes: string;
  onNotesChange: (s: string) => void;
  brandKit: { logo_url?: string | null; photos?: string[] | null; people_photos?: string[] | null; primary_color?: string | null } | null | undefined;
  onAnalyze: () => void;
  analyzing: boolean;
}

export default function KvMaterialsStep({ materials, onMaterialsChange, notes, onNotesChange, brandKit, onAnalyze, analyzing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const added: Material[] = [];
    for (const f of list) {
      try {
        setLoading(`Lendo ${f.name}…`);
        added.push(await loadMaterial(f, (msg) => setLoading(`${f.name}: ${msg}`)));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Não foi possível ler ${f.name}`);
      }
    }
    setLoading(null);
    if (added.length) onMaterialsChange([...materials, ...added]);
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

  const setRole = (id: string, role: ImageRole) =>
    onMaterialsChange(materials.map((m) => (m.id === id && m.kind === 'image' ? { ...m, role } : m)));
  const remove = (id: string) => onMaterialsChange(materials.filter((m) => m.id !== id));

  const fonts = fontFamiliesFrom(materials);
  const hasLogo = materials.some((m) => m.kind === 'image' && (m.role === 'logo' || m.role === 'auto'));
  const canAnalyze = materials.length > 0 && !loading && !analyzing;

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-4">
        {/* Drop zone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          disabled={!!loading}
          className={cn(
            'w-full rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 text-center transition-all',
            dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-secondary/40',
          )}
        >
          {loading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
          <span className="text-sm font-semibold">{loading ?? 'Solte aqui os materiais do cliente'}</span>
          <span className="text-xs text-muted-foreground max-w-md">
            Brandbook e apresentações em PDF, logotipo (PNG, SVG ou JPG), peças já aprovadas, fotos e briefing (TXT, CSV, MD).
            Quanto mais material, mais fiel o manual.
          </span>
        </button>
        <input ref={inputRef} type="file" multiple className="hidden"
          accept=".pdf,image/*,.svg,.txt,.md,.csv,.json"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />

        {brandKit && (brandKit.logo_url || brandKit.photos?.length || brandKit.people_photos?.length) ? (
          <Button variant="outline" size="sm" onClick={importFromBrandKit} disabled={!!loading} className="gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Importar logo e fotos do Brand Kit do projeto
          </Button>
        ) : null}

        {/* Materials */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence initial={false}>
            {materials.map((m) => (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                className="rounded-xl border bg-card overflow-hidden group">
                {m.kind === 'image' && (
                  <div className="h-32 checkerboard flex items-center justify-center p-2">
                    <img src={m.thumb} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                {m.kind === 'pdf' && (
                  <div className="h-32 bg-secondary/60 flex gap-1 p-2 overflow-hidden">
                    {m.pages.slice(0, 4).map((p) => <img key={p.number} src={p.thumb} alt="" className="h-full w-auto rounded-sm shadow" />)}
                  </div>
                )}
                {m.kind === 'text' && (
                  <div className="h-32 bg-secondary/60 p-3 text-[10px] text-muted-foreground overflow-hidden leading-snug whitespace-pre-wrap">{m.text.slice(0, 400)}</div>
                )}
                <div className="p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    {m.kind === 'pdf' ? <FileType2 className="h-3.5 w-3.5 text-primary flex-none" /> : m.kind === 'text' ? <FileText className="h-3.5 w-3.5 text-primary flex-none" /> : <ImageIcon className="h-3.5 w-3.5 text-primary flex-none" />}
                    <span className="text-xs font-medium truncate flex-1" title={m.name}>{m.name}</span>
                    <button onClick={() => remove(m.id)} className="opacity-60 hover:opacity-100 hover:text-destructive transition" title="Remover">
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Side: briefing + checklist */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h3 className="text-sm font-bold">Briefing e observações</h3>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={'Ex.: "Laranja com neutros; vermelho nunca." · "Público: construtoras." · "Não temos o manual, só estas peças aprovadas."'}
            className="min-h-[140px] text-xs bg-secondary resize-none"
          />
          <p className="text-[10px] text-muted-foreground">Restrições, público, produtos e o que já foi aprovado pelo cliente. A IA segue isso à risca.</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-2 text-xs">
          <h3 className="text-sm font-bold">O que a IA vai usar</h3>
          <Check ok={materials.some((m) => m.kind === 'pdf')} label="PDF de marca (cores, textos e fontes oficiais)" />
          <Check ok={hasLogo} label="Logotipo (de preferência PNG transparente ou SVG)" />
          <Check ok={materials.some((m) => m.kind === 'image' && (m.role === 'foto' || m.role === 'peca'))} label="Fotos ou peças aprovadas" />
          <Check ok={notes.trim().length > 20} label="Briefing com restrições e público" />
          {fonts.length > 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">Fontes encontradas nos PDFs: <b className="text-foreground">{fonts.join(', ')}</b></p>
          )}
        </div>

        <Button onClick={onAnalyze} disabled={!canAnalyze} className="w-full h-11 gap-2 text-sm font-semibold">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? 'Analisando materiais…' : 'Analisar com IA'}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Wand2 className="h-3 w-3" /> Nada é gerado antes da sua aprovação no próximo passo.
        </p>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn('mt-0.5 h-3.5 w-3.5 rounded-full flex-none border flex items-center justify-center text-[9px]', ok ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40')}>
        {ok ? '✓' : ''}
      </span>
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
