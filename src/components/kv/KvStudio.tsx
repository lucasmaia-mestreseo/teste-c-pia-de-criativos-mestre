import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpenCheck, Check, Compass, Download, FolderOpen, Layers3, LayoutGrid, Loader2, Palette, Sparkles, Trash2, Type, Upload,
} from 'lucide-react';
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
import { StrategyView, StructureView } from './KvPlanPanel';
import {
  buildAnalyzeRequest, buildLogoSet, photoCandidates, pickLogoMaterials, renderLogoAssets,
  type ImageInsight, type LogoSet, type Material, type PhotoCandidate,
} from '@/kv/pipeline';
import { normalizeSpec, type ManualSpec } from '@/kv/spec';
import { buildTokens, fillTemplate, type FillResult } from '@/kv/fillTemplate';
import { googleEquivalent, googleFontsQuery } from '@/kv/fonts';
import { activateManual, deleteManual, downloadText, listManuals, manualLabel, readManualSpec, type SavedManual } from '@/kv/manualStorage';
import { useActiveGuide } from './ActiveGuideBadge';
import { briefingsToText, type Briefing } from '@/kv/briefing';
import { TEMPLATE_PAGES, normalizePlan, outline, isIncluded, type ManualPlan } from '@/kv/structure';

type Stage = 'materials' | 'review' | 'manual';
type ReviewTab = 'estrategia' | 'estrutura' | 'identidade' | 'textos';

const STAGES: { id: Stage; label: string; icon: typeof Upload; hint: string }[] = [
  { id: 'materials', label: 'Briefing e materiais', icon: Upload, hint: 'Traga o que o cliente enviou: respostas do briefing, brandbook, logotipo e peças. A IA lê tudo antes de propor qualquer coisa.' },
  { id: 'review', label: 'Leitura da IA', icon: Compass, hint: 'Confira o que a IA entendeu e como o manual vai ficar. Nada vira página sem o seu OK.' },
  { id: 'manual', label: 'Manual', icon: BookOpenCheck, hint: 'Manual pronto: navegue pelas páginas, baixe o PDF e leve a identidade para a geração de criativos.' },
];

type Phase = 'read' | 'identity' | 'strategy';
const PHASES: { id: Phase; label: string; tips: string[] }[] = [
  { id: 'read', label: 'Lendo briefing e materiais', tips: ['Abrindo os PDFs…', 'Separando as respostas do briefing…'] },
  { id: 'identity', label: 'Identidade: cores, fontes e logo', tips: ['Medindo as cores da marca…', 'Conferindo a tipografia…', 'Separando logo, símbolo e fotos…', 'Escrevendo headlines e CTAs…'] },
  { id: 'strategy', label: 'Estratégia: a forma do manual', tips: ['Cruzando cada resposta com as páginas…', 'Decidindo o que entra e o que sai…', 'Escrevendo as páginas sob medida…'] },
];

const TEMPLATE_CATALOG = TEMPLATE_PAGES.map((p) => ({ id: p.id, titulo: p.titulo, capitulo: p.capitulo, tipo: p.tipo, nota: !!p.nota, essencial: !!p.essencial, descricao: p.descricao }));

export default function KvStudio({ projectId }: { projectId: string }) {
  const { data: brandKit } = useBrandKit(projectId);
  const { data: project } = useProject(projectId);
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [stage, setStage] = useState<Stage>('materials');
  const [tab, setTab] = useState<ReviewTab>('identidade');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase | null>(null);
  const [tip, setTip] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [spec, setSpec] = useState<ManualSpec | null>(null);
  const [plan, setPlan] = useState<ManualPlan | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
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
    setStage('materials'); setMaterials([]); setBriefings([]); setNotes(''); setSpec(null); setPlan(null); setResult(null); setPhotos([]); setSelectedPhotos([]);
  }, [projectId]);

  useEffect(() => {
    if (!phase) return;
    setTip(0);
    const t = setInterval(() => setTip((i) => i + 1), 2600);
    return () => clearInterval(t);
  }, [phase]);

  const picks = useMemo(() => pickLogoMaterials(materials, insights), [materials, insights]);
  const logoSet: LogoSet | null = useMemo(() => {
    if (!spec) return null;
    try {
      return buildLogoSet(picks.logo, { tagline: picks.tagline, simbolo: picks.simbolo, simboloBox: picks.simboloBox, principal: spec.cores.principal.hex });
    } catch {
      return null;
    }
  }, [picks, spec?.cores.principal.hex]); // eslint-disable-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => (spec ? buildTokens(spec) : null), [spec]);
  const entries = useMemo(() => outline(plan), [plan]);

  /** Strategy step: the briefing decides the shape of the manual. Failing here is not fatal — the standard structure stays. */
  const runPlan = async (s: ManualSpec, materialsText: string): Promise<ManualPlan | null> => {
    const data = await invokeWithRetry<{ plan: unknown }>('kv-plan', {
      projectId, briefing: briefingsToText(briefings), notes, spec: s, materialsText: materialsText.slice(0, 8000), pages: TEMPLATE_CATALOG,
    }, { friendlyName: 'Estratégia do manual', projectId, maxRetries: 1 });
    return normalizePlan(data.plan);
  };

  const analyze = async () => {
    setPhase('read');
    try {
      const req = buildAnalyzeRequest(materials, notes);
      setPhase('identity');
      const data = await invokeWithRetry<{ spec: unknown; images: ImageInsight[] }>('kv-analyze',
        { projectId, ...req, briefing: briefings.length ? briefingsToText(briefings) : undefined },
        { friendlyName: 'Análise do manual', projectId, maxRetries: 1 });
      const s = normalizeSpec(data.spec as Partial<ManualSpec>);
      if (!s.marca) s.marca = project?.name ?? '';
      const ins = Array.isArray(data.images) ? data.images : [];
      setInsights(ins);
      setSpec(s);
      const cands = photoCandidates(materials, ins);
      setPhotos(cands);
      setSelectedPhotos(cands.slice(0, 3).map((c) => c.id));

      let p: ManualPlan | null = null;
      if (briefings.length) {
        setPhase('strategy');
        try {
          p = await runPlan(s, req.pdfText);
        } catch (e) {
          toast.warning('A estratégia não saiu desta vez', { description: `${e instanceof Error ? e.message : ''} O manual segue a estrutura padrão — tente “Moldar pelo briefing” na aba Estrutura.` });
        }
      }
      setPlan(p);
      setTab(p ? 'estrategia' : 'identidade');
      setStage('review');
      toast.success('Leitura pronta', { description: p ? 'Comece pela estratégia: veja como cada resposta do briefing entrou no manual.' : 'Revise o resumo e aprove para montar o manual.' });
    } catch (e) {
      toast.error('A leitura falhou', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setPhase(null);
    }
  };

  const replan = async () => {
    if (!spec) return;
    setPlanning(true);
    try {
      const p = await runPlan(spec, buildAnalyzeRequest(materials, notes).pdfText);
      setPlan(p);
      toast.success('Estrutura refeita a partir do briefing');
    } catch (e) {
      toast.error('Não foi possível montar a estrutura', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setPlanning(false);
    }
  };

  const jumpTo = (key: string) => {
    setTab('estrutura');
    setHighlight(key);
    setTimeout(() => setHighlight(null), 2400);
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
      setBuildMsg(`Montando as ${entries.length} páginas…`);
      const chosen = selectedPhotos.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as PhotoCandidate[];
      const res = fillTemplate(finalSpec, { ...assetsBase, fotos: chosen.map((c) => ({ url: c.url, foco: c.foco })) }, { googleFontsQuery: fonts.query, plan });
      if (swaps.length) setSpec(finalSpec);
      setResult(res);
      setLogoForKit(logoSet ? logoSet.cor.toDataURL('image/png') : null);
      setStage('manual');
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
      const raw = specText ? JSON.parse(specText) : null;
      const s = raw ? normalizeSpec(raw) : spec;
      if (!s) throw new Error('Manual sem dados');
      const p = raw?.plano ? normalizePlan(raw.plano) : null;
      setSpec(s);
      setPlan(p);
      setResult({ html, log: [{ ok: true, label: 'Manual salvo carregado' }], remainingMarkers: [], leftoverTerms: [], tokens: buildTokens(s), pageCount: outline(p).length });
      setLogoForKit(null);
      setStage('manual');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error('Não foi possível abrir o manual', { description: e instanceof Error ? e.message : undefined });
    }
  }, [spec]);

  const stageIndex = STAGES.findIndex((s) => s.id === stage);
  const reachable = (s: Stage) => s === 'materials' || (s === 'review' && !!spec) || (s === 'manual' && !!result);
  const caption = (s: Stage) => {
    if (s === 'materials') {
      const parts = [briefings.length && 'briefing', materials.length && `${materials.length} arquivo(s)`].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'o que o cliente enviou';
    }
    if (s === 'review') return spec ? (plan ? `${entries.length} páginas · ${entries.filter((e) => e.tipo === 'extra' || e.tipo === 'contexto').length} sob medida` : 'identidade e textos') : 'estratégia e identidade';
    return result ? `${result.pageCount ?? 38} páginas prontas` : 'PDF e identidade';
  };

  const TABS: { id: ReviewTab; label: string; icon: typeof Palette; hidden?: boolean }[] = [
    { id: 'estrategia', label: 'Estratégia', icon: Compass, hidden: !plan?.cobertura.length && !plan?.diagnostico.problema },
    { id: 'estrutura', label: 'Estrutura', icon: LayoutGrid },
    { id: 'identidade', label: 'Identidade', icon: Palette },
    { id: 'textos', label: 'Textos', icon: Type },
  ];
  const visibleTabs = TABS.filter((t) => !t.hidden);
  const showLp = isIncluded(plan, 'lp-exemplo-topo') || isIncluded(plan, 'lp-exemplo-continuacao');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-5">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
              <Layers3 className="h-4 w-4" /> Criação de KVs
            </div>
            <h1 className="text-2xl font-bold mt-1">Manual de Comunicação Digital</h1>
            <p key={stage} className="text-sm text-muted-foreground mt-1 max-w-2xl animate-in fade-in duration-500">{STAGES[stageIndex].hint}</p>
          </div>

          {/* Journey */}
          <div className="relative grid grid-cols-3 gap-2">
            <div className="absolute left-[16.66%] right-[16.66%] top-[18px] h-px bg-border hidden sm:block" />
            <div className="absolute left-[16.66%] top-[18px] h-px bg-primary hidden sm:block transition-all duration-700 ease-out"
              style={{ width: `${(stageIndex / 2) * 66.66}%` }} />
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const done = i < stageIndex;
              const current = s.id === stage;
              const ok = reachable(s.id);
              return (
                <button key={s.id} disabled={!ok} onClick={() => ok && setStage(s.id)}
                  className={cn('relative flex flex-col items-center text-center gap-1.5 group', !ok && 'cursor-default')}>
                  <span className={cn('relative z-10 h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all duration-500',
                    current ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)] scale-110'
                      : done ? 'bg-primary/15 border-primary/60 text-primary'
                        : 'bg-background border-border text-muted-foreground',
                    ok && !current && 'group-hover:border-primary group-hover:text-primary')}>
                    {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className={cn('text-xs font-semibold transition-colors', current ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
                  <span className="text-[10.5px] text-muted-foreground/80 hidden sm:block">{caption(s.id)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!can('generate_creative') && (
          <p className="text-xs text-amber-500">Seu perfil não tem permissão para gerar com IA; você pode ver os manuais salvos.</p>
        )}

        {/* CSS animation (not AnimatePresence): the next stage mounts immediately even
            when the tab is in the background and animation frames are paused. */}
        <div key={stage} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {stage === 'materials' && (
            <KvMaterialsStep materials={materials} onMaterialsChange={setMaterials} briefings={briefings} onBriefingsChange={setBriefings}
              notes={notes} onNotesChange={setNotes} brandKit={brandKit as never} onAnalyze={analyze} analyzing={!!phase} />
          )}

          {stage === 'review' && spec && tokens && (
            <div className="space-y-6">
              {/* tabs */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
                  {visibleTabs.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn('relative flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-medium transition-colors duration-200',
                          tab === t.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        {tab === t.id && <motion.span layoutId="kv-review-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                        <Icon className="h-3.5 w-3.5 relative" />
                        <span className={cn('relative', tab !== t.id && 'hidden sm:inline')}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                {tab === 'estrategia' && plan && (
                  <StrategyView plan={plan} onChange={setPlan} onJump={jumpTo} onReplan={replan} replanning={planning} />
                )}
                {tab === 'estrutura' && (
                  <StructureView plan={plan} onChange={setPlan} tokens={tokens} highlight={highlight}
                    canPlan={briefings.length > 0} onPlan={replan} planning={planning} />
                )}
                {(tab === 'identidade' || tab === 'textos') && (
                  <KvReviewStep spec={spec} onSpecChange={setSpec} logoSet={logoSet} photos={photos}
                    selectedPhotos={selectedPhotos} onSelectedPhotosChange={setSelectedPhotos}
                    onPhotoFocus={(id, foco) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, foco } : p)))}
                    vectorizeLogos={vectorizeLogos} onVectorizeChange={setVectorizeLogos}
                    section={tab} showLp={showLp} />
                )}
              </div>

              {/* approve bar */}
              <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gradient-to-t from-background via-background/95 to-background/0">
                <div className="glass rounded-2xl border px-3 sm:px-4 py-2.5 flex items-center gap-3 shadow-2xl">
                  <Button variant="ghost" size="sm" onClick={() => setStage('materials')} className="gap-1.5"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Materiais</span></Button>
                  <div className="flex-1 text-center text-[11px] text-muted-foreground truncate">
                    <b className="text-foreground tabular-nums">{entries.length}</b> páginas
                    {plan && <> · <b className="text-primary tabular-nums">{entries.filter((e) => e.tipo === 'extra' || e.tipo === 'contexto').length}</b> sob medida · <b className="text-foreground tabular-nums">{plan.notas.length}</b> orientações reescritas</>}
                  </div>
                  <Button onClick={build} disabled={building || !spec.marca.trim()} className="h-10 px-5 gap-2 font-semibold btn-shine">
                    {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {building ? 'Montando…' : 'Aprovar e montar'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {stage === 'manual' && spec && result && (
            <KvManualStep projectId={projectId} spec={spec} result={result} logoForKit={logoForKit}
              pageTitles={entries.map((e) => e.titulo)} plan={plan} briefings={briefings}
              photosForKit={selectedPhotos.map((id) => photos.find((p) => p.id === id)?.url).filter(Boolean) as string[]}
              onBack={() => setStage('review')} onSaved={() => qc.invalidateQueries({ queryKey: ['kv-manuals', projectId] })} />
          )}
        </div>

        <SavedManuals projectId={projectId} onOpen={openSaved} />
      </div>

      {/* Busy overlay: the phases, so the wait reads as progress */}
      {(phase || building) && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="rounded-2xl border bg-card shadow-2xl px-7 py-6 w-[340px] animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative h-10 w-10 flex-none">
                <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{building ? 'Montando o manual' : 'Lendo com IA'}</p>
                <p className="text-[11px] text-muted-foreground">{building ? 'Vetorizando e preenchendo — alguns segundos.' : 'Costuma levar de 1 a 2 minutos.'}</p>
              </div>
            </div>
            {building ? (
              <p key={buildMsg} className="text-xs text-center animate-in fade-in duration-300">{buildMsg || 'Preparando…'}</p>
            ) : (
              <ol className="space-y-3">
                {PHASES.filter((ph) => ph.id !== 'strategy' || briefings.length).map((ph) => {
                  const order = PHASES.findIndex((x) => x.id === ph.id);
                  const cur = PHASES.findIndex((x) => x.id === phase);
                  const state = order < cur ? 'done' : order === cur ? 'now' : 'next';
                  return (
                    <li key={ph.id} className="flex items-start gap-3">
                      <span className={cn('mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-none transition-all duration-500',
                        state === 'done' ? 'bg-primary text-primary-foreground' : state === 'now' ? 'border-2 border-primary' : 'border border-muted-foreground/30')}>
                        {state === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : state === 'now' ? <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className={cn('text-xs font-medium transition-colors', state === 'next' ? 'text-muted-foreground' : 'text-foreground')}>{ph.label}</p>
                        {state === 'now' && <p key={tip} className="text-[11px] text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">{ph.tips[tip % ph.tips.length]}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
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
  const { data: active } = useActiveGuide(projectId);
  const [activating, setActivating] = useState<string | null>(null);
  if (isLoading || !manuals?.length) return null;

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
  const activate = async (m: SavedManual) => {
    setActivating(m.name);
    try {
      const spec = await readManualSpec(m);
      await activateManual(projectId, m, spec);
      qc.invalidateQueries({ queryKey: ['active-guide', projectId] });
      qc.invalidateQueries({ queryKey: ['brand_kit', projectId] });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success(`"${manualLabel(m).campaign}" agora é o guia ativo`, { description: 'Gerar e Desdobramento passam a seguir este guia.' });
    } catch (e) {
      toast.error('Não foi possível ativar o guia', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setActivating(null);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> Guias de marca deste projeto</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Um guia por campanha. O <b className="text-foreground">ativo</b> é o que a geração de criativos e o Desdobramento seguem.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 stagger">
        {manuals.map((m) => {
          const isActive = active?.name === m.name;
          const { brand, date } = manualLabel(m);
          const campaign = isActive && active ? active.campaign : manualLabel(m).campaign;
          return (
            <div key={m.name} className={cn('group rounded-xl border p-3 flex items-center gap-3 card-hover', isActive && 'border-primary/50 bg-primary/5')}>
              <BookOpenCheck className={cn('h-8 w-8 flex-none', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold capitalize truncate">{campaign}</span>
                  {isActive && <span className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wide px-1.5 py-px flex-none">Ativo</span>}
                </div>
                <div className="text-[11px] text-muted-foreground truncate"><span className="capitalize">{brand}</span> · {date}</div>
              </div>
              {!isActive && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => activate(m)} disabled={!!activating}>
                  {activating === m.name ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ativar'}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(m)}>Abrir</Button>
              <button onClick={() => download(m)} className="text-muted-foreground hover:text-primary transition-colors" title="Baixar HTML"><Download className="h-4 w-4" /></button>
              <button onClick={() => remove(m)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100" title="Excluir"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
