import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Download, FileSearch, FolderOpen, Layers3, Loader2, PenLine, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useProject } from '@/hooks/useProject';
import { usePermissions } from '@/hooks/usePermissions';
import KvMaterialsStep from './KvMaterialsStep';
import KvReviewStep from './KvReviewStep';
import KvManualStep from './KvManualStep';
import {
  buildAnalyzeRequest, buildLogoSet, photoCandidates, pickLogoMaterials, renderLogoAssets,
  type ImageInsight, type LogoSet, type Material, type PhotoCandidate,
} from '@/kv/pipeline';
import { normalizeSpec, type ManualSpec } from '@/kv/spec';
import { buildTokens, fillTemplate, type FillResult } from '@/kv/fillTemplate';
import { googleEquivalent, googleFontsQuery } from '@/kv/fonts';
import { deleteManual, downloadText, listManuals, manualLabel, type SavedManual } from '@/kv/manualStorage';

type Step = 'materials' | 'review' | 'manual';

const STEPS: { id: Step; label: string; icon: typeof FileSearch }[] = [
  { id: 'materials', label: 'Materiais', icon: FileSearch },
  { id: 'review', label: 'Resumo para aprovação', icon: PenLine },
  { id: 'manual', label: 'Manual', icon: BookOpenCheck },
];

const ANALYZE_MESSAGES = [
  'Lendo os PDFs e as peças…',
  'Medindo as cores da marca…',
  'Conferindo a tipografia…',
  'Separando logo, símbolo e fotos…',
  'Escrevendo headlines e CTAs…',
  'Montando a direção de imagem…',
];

export default function KvStudio({ projectId }: { projectId: string }) {
  const { data: brandKit } = useBrandKit(projectId);
  const { data: project } = useProject(projectId);
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('materials');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState(0);
  const [spec, setSpec] = useState<ManualSpec | null>(null);
  const [insights, setInsights] = useState<ImageInsight[]>([]);
  const [photos, setPhotos] = useState<PhotoCandidate[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [vectorizeLogos, setVectorizeLogos] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState('');
  const [result, setResult] = useState<FillResult | null>(null);
  const [logoForKit, setLogoForKit] = useState<string | null>(null);

  // reset when switching projects
  useEffect(() => {
    setStep('materials'); setMaterials([]); setNotes(''); setSpec(null); setResult(null); setPhotos([]); setSelectedPhotos([]);
  }, [projectId]);

  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => setAnalyzeMsg((i) => (i + 1) % ANALYZE_MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, [analyzing]);

  const picks = useMemo(() => pickLogoMaterials(materials, insights), [materials, insights]);
  const logoSet: LogoSet | null = useMemo(() => {
    if (!spec) return null;
    try {
      return buildLogoSet(picks.logo, { tagline: picks.tagline, simbolo: picks.simbolo, simboloBox: picks.simboloBox, principal: spec.cores.principal.hex });
    } catch {
      return null;
    }
  }, [picks, spec?.cores.principal.hex]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeMsg(0);
    try {
      const body = { projectId, ...buildAnalyzeRequest(materials, notes) };
      const data = await invokeWithRetry<{ spec: unknown; images: ImageInsight[] }>('kv-analyze', body, { friendlyName: 'Análise do manual', projectId, maxRetries: 1 });
      const s = normalizeSpec(data.spec as Partial<ManualSpec>);
      if (!s.marca) s.marca = project?.name ?? '';
      const ins = Array.isArray(data.images) ? data.images : [];
      setInsights(ins);
      setSpec(s);
      const cands = photoCandidates(materials, ins);
      setPhotos(cands);
      setSelectedPhotos(cands.slice(0, 3).map((c) => c.id));
      setStep('review');
      toast.success('Análise pronta', { description: 'Revise o resumo e aprove para montar o manual.' });
    } catch (e) {
      toast.error('A análise falhou', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setAnalyzing(false);
    }
  };

  const build = async () => {
    if (!spec) return;
    setBuilding(true);
    try {
      const assetsBase = logoSet
        ? await renderLogoAssets(logoSet, spec, vectorizeLogos, setBuildMsg)
        : { logoCor: null, logoBranco: null, logoNavy: null, logoApoio: null, logoPreto: null, simboloCor: null, simboloBranco: null, simboloNavy: null, razaoLogo: 3, razaoSimbolo: 1 };
      setBuildMsg('Carregando as fontes…');
      // Fonts that aren't on Google Fonts (Helvetica, Gotham…) → closest free equivalent, noted in the manual.
      const finalSpec = structuredClone(spec);
      const swaps: string[] = [];
      let fonts = await googleFontsQuery([finalSpec.tipografia.primaria, finalSpec.tipografia.secundaria]);
      if (fonts.missing.length) {
        for (const k of ['primaria', 'secundaria'] as const) {
          const name = finalSpec.tipografia[k];
          const eq = fonts.missing.includes(name) ? googleEquivalent(name) : null;
          if (eq) { finalSpec.tipografia[k] = eq; if (!swaps.some((s) => s.startsWith(name))) swaps.push(`${name} → ${eq}`); }
        }
        if (swaps.length) {
          finalSpec.tipografia.nota = [finalSpec.tipografia.nota,
            `A fonte oficial (${swaps.map((s) => s.split(' → ')[0]).join(', ')}) não é gratuita no digital; o manual usa ${swaps.map((s) => s.split(' → ')[1]).join(', ')}, a equivalente mais próxima no Google Fonts.`,
          ].filter(Boolean).join(' ');
          fonts = await googleFontsQuery([finalSpec.tipografia.primaria, finalSpec.tipografia.secundaria]);
          toast.info(`Fonte equivalente aplicada: ${swaps.join(', ')}`);
        }
        if (fonts.missing.length) toast.warning(`Fonte não encontrada no Google Fonts: ${fonts.missing.join(', ')}`, { description: 'O manual usa a fonte de sistema mais próxima. Troque no resumo se quiser.' });
      }
      setBuildMsg('Preenchendo as 38 páginas…');
      const chosen = selectedPhotos.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as PhotoCandidate[];
      const res = fillTemplate(finalSpec, { ...assetsBase, fotos: chosen.map((c) => ({ url: c.url, foco: c.foco })) }, { googleFontsQuery: fonts.query });
      if (swaps.length) setSpec(finalSpec);
      setResult(res);
      setLogoForKit(logoSet ? logoSet.cor.toDataURL('image/png') : null);
      setStep('manual');
    } catch (e) {
      toast.error('Não foi possível montar o manual', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBuilding(false);
      setBuildMsg('');
    }
  };

  const openSaved = useCallback(async (m: SavedManual) => {
    try {
      const [html, specText] = await Promise.all([downloadText(m.htmlPath), downloadText(m.specPath).catch(() => null)]);
      const s = specText ? normalizeSpec(JSON.parse(specText)) : spec;
      if (!s) throw new Error('Manual sem dados');
      setSpec(s);
      setResult({ html, log: [{ ok: true, label: 'Manual salvo carregado' }], remainingMarkers: [], leftoverTerms: [], tokens: buildTokens(s) });
      setLogoForKit(null);
      setStep('manual');
    } catch (e) {
      toast.error('Não foi possível abrir o manual', { description: e instanceof Error ? e.message : undefined });
    }
  }, [spec]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
              <Layers3 className="h-4 w-4" /> Criação de KVs
            </div>
            <h1 className="text-2xl font-bold mt-1">Manual de Comunicação Digital</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Materiais do cliente → análise da IA → seu OK → manual de 38 páginas no padrão Agência Mestre.
            </p>
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-1 rounded-full border bg-card p-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const reachable = i <= stepIndex || (s.id === 'review' && spec) || (s.id === 'manual' && result);
              return (
                <button key={s.id} disabled={!reachable} onClick={() => reachable && setStep(s.id)}
                  className={cn('relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    step === s.id ? 'text-primary-foreground' : reachable ? 'text-foreground hover:text-primary' : 'text-muted-foreground/50')}>
                  {step === s.id && <motion.span layoutId="kv-step" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <Icon className="h-3.5 w-3.5 relative" />
                  <span className="relative hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!can('generate_creative') && (
          <p className="text-xs text-amber-500">Seu perfil não tem permissão para gerar com IA; você pode ver os manuais salvos.</p>
        )}

        {/* CSS animation (not AnimatePresence): the next step mounts immediately even
            when the tab is in the background and animation frames are paused. */}
        <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {step === 'materials' && (
              <KvMaterialsStep materials={materials} onMaterialsChange={setMaterials} notes={notes} onNotesChange={setNotes}
                brandKit={brandKit as never} onAnalyze={analyze} analyzing={analyzing} />
            )}
            {step === 'review' && spec && (
              <KvReviewStep spec={spec} onSpecChange={setSpec} logoSet={logoSet} photos={photos}
                selectedPhotos={selectedPhotos} onSelectedPhotosChange={setSelectedPhotos}
                onPhotoFocus={(id, foco) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, foco } : p)))}
                vectorizeLogos={vectorizeLogos} onVectorizeChange={setVectorizeLogos}
                onBack={() => setStep('materials')} onApprove={build} building={building} />
            )}
            {step === 'manual' && spec && result && (
              <KvManualStep projectId={projectId} spec={spec} result={result} logoForKit={logoForKit}
                photosForKit={selectedPhotos.map((id) => photos.find((p) => p.id === id)?.url).filter(Boolean) as string[]}
                onBack={() => setStep('review')} onSaved={() => qc.invalidateQueries({ queryKey: ['kv-manuals', projectId] })} />
            )}
        </div>

        <SavedManuals projectId={projectId} onOpen={openSaved} />
      </div>

      {/* Busy overlay */}
      {(analyzing || building) && (
          <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="rounded-2xl border bg-card shadow-2xl px-8 py-7 flex flex-col items-center gap-4 min-w-[300px] animate-in zoom-in-95 duration-300">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
              <p key={analyzing ? analyzeMsg : buildMsg} className="text-sm font-medium text-center animate-in fade-in slide-in-from-bottom-1 duration-300">
                {analyzing ? ANALYZE_MESSAGES[analyzeMsg] : buildMsg || 'Montando o manual…'}
              </p>
              <p className="text-[11px] text-muted-foreground">{analyzing ? 'Costuma levar de 30 a 90 segundos.' : 'Vetorizando e preenchendo — alguns segundos.'}</p>
            </div>
          </div>
      )}
    </div>
  );
}

function SavedManuals({ projectId, onOpen }: { projectId: string; onOpen: (m: SavedManual) => void }) {
  const qc = useQueryClient();
  const { data: manuals, isLoading } = useQuery({
    queryKey: ['kv-manuals', projectId],
    queryFn: () => listManuals(projectId),
  });
  if (isLoading) return null;
  if (!manuals?.length) return null;

  const download = async (m: SavedManual) => {
    const html = await downloadText(m.htmlPath);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `${m.name}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const remove = async (m: SavedManual) => {
    await deleteManual(m);
    qc.invalidateQueries({ queryKey: ['kv-manuals', projectId] });
    toast.success('Manual removido');
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Manuais salvos deste projeto</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {manuals.map((m) => {
          const { brand, date } = manualLabel(m);
          return (
            <div key={m.name} className="rounded-xl border p-3 flex items-center gap-3 hover:border-primary/40 transition">
              <BookOpenCheck className="h-8 w-8 text-primary flex-none" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold capitalize truncate">{brand}</div>
                <div className="text-[11px] text-muted-foreground">{date}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(m)}>Abrir</Button>
              <button onClick={() => download(m)} className="text-muted-foreground hover:text-primary" title="Baixar HTML"><Download className="h-4 w-4" /></button>
              <button onClick={() => remove(m)} className="text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  );
}
