import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AudioLines, Bot, Captions, Check, Clapperboard, Download, Film, Loader2, Pause, Play, RefreshCw, Scissors, Sparkles, SunMedium, Type, Upload, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { invokeWithRetry } from '@/lib/invokeWithRetry';
import {
  DEFAULT_EDIT_SETTINGS, applyOperations, buildBlocks, buildSrt, cssFilter, detectCuts, fmtTime, keepRanges, mapTime, markWords, mergeCuts,
  newCutId, setPath, suggestWhiteBalance, summarize, wordRegion,
  type AstraOp, type CaptionBlock, type Cut, type CutReason, type EditSettings, type Range, type Word,
} from '@/video/engine';
import { analyzeAudio, detectSilences, grabFrame, meanFrameColor, probeVideo, speechRegions, type AudioAnalysis, type Probe } from '@/video/media';
import VideoTimeline from './VideoTimeline';
import { AstraPanel, AudioPanel, CaptionsPanel, CutsPanel, ImagePanel, TranscriptPanel, type AstraMsg } from './VideoPanels';

type Tab = 'texto' | 'cortes' | 'imagem' | 'audio' | 'legendas' | 'astra';
const TABS: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: 'texto', label: 'Transcrição', icon: Type },
  { id: 'cortes', label: 'Cortes', icon: Scissors },
  { id: 'imagem', label: 'Imagem', icon: SunMedium },
  { id: 'audio', label: 'Áudio', icon: AudioLines },
  { id: 'legendas', label: 'Legendas', icon: Captions },
  { id: 'astra', label: 'Astra', icon: Bot },
];

const RENDER_STEPS = (cuts: number, s: EditSettings) => [
  `Aplicando ${cuts} corte(s)…`,
  s.image.enabled ? 'Tratando a imagem (ruído, cor, curva, nitidez)…' : 'Mantendo a imagem original…',
  s.audio.enabled ? `Tratando o áudio — pico final em ${String(s.audio.targetPeakDb).replace('.', ',')} dB…` : 'Mantendo o áudio original…',
  s.captions.enabled && s.output.burnCaptions ? 'Queimando as legendas…' : 'Gerando o .SRT…',
  `Finalizando o MP4 (CRF ${s.output.crf}, mesma resolução e frame rate)…`,
];

interface Loaded { file: File; url: string; probe: Probe }

export default function VideoStudio({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<PlayerHandle>(null);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [audio, setAudio] = useState<AudioAnalysis | null>(null);
  const [wbSuggestion, setWbSuggestion] = useState<number | null>(null);
  const [settings, setSettings] = useState<EditSettings>(structuredClone(DEFAULT_EDIT_SETTINGS));
  const [rawWords, setRawWords] = useState<Word[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('texto');
  const [time, setTime] = useState(0);
  const [skipCuts, setSkipCuts] = useState(true);
  const [frames, setFrames] = useState<{ before: string; after: string } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [astraLog, setAstraLog] = useState<AstraMsg[]>([]);
  const [astraBusy, setAstraBusy] = useState(false);
  const [render, setRender] = useState<{ step: number; steps: string[] } | null>(null);
  const [result, setResult] = useState(false);
  const [sampleProgress, setSampleProgress] = useState<number | null>(null);

  const duration = loaded?.probe.duration ?? 0;
  const words = useMemo(() => markWords(rawWords, cuts), [rawWords, cuts]);
  const keeps = useMemo(() => keepRanges(duration, cuts), [duration, cuts]);
  const summary = useMemo(() => summarize(duration, cuts), [duration, cuts]);
  const blocks = useMemo(() => (settings.captions.enabled ? buildBlocks(words, keeps, settings.captions) : []), [words, keeps, settings.captions]);
  const filter = useMemo(() => cssFilter(settings.image), [settings.image]);

  useEffect(() => () => { if (loaded) URL.revokeObjectURL(loaded.url); }, [loaded]);

  /* ─── open ─── */
  const openFile = async (file: File) => {
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|mkv|webm|m4v)$/i.test(file.name)) { toast.error('Envie um vídeo (MP4, MOV, MKV ou WEBM)'); return; }
    const url = URL.createObjectURL(file);
    setPreparing('Lendo o vídeo…');
    try {
      const probe = await probeVideo(url);
      setLoaded({ file, url, probe });
      setRawWords([]); setCuts([]); setAnalyzed(false); setFrames(null); setAstraLog([]); setTime(0);
      setSettings(structuredClone(DEFAULT_EDIT_SETTINGS));
      setPreparing('Desenhando a waveform…');
      const [a, rgb] = await Promise.all([analyzeAudio(file), meanFrameColor(url, probe.duration)]);
      setAudio(a);
      setWbSuggestion(rgb ? suggestWhiteBalance(rgb) : null);
      if (!a) toast.info('Não deu para ler o áudio no navegador', { description: 'A timeline fica sem waveform; os cortes por palavra continuam funcionando.' });
    } catch (e) {
      URL.revokeObjectURL(url);
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o vídeo');
    } finally {
      setPreparing(null);
    }
  };

  const makeSample = async () => {
    setSampleProgress(0);
    try {
      const { makeSampleVideo } = await import('@/demo/videoDemo');
      const file = await makeSampleVideo((p) => setSampleProgress(p));
      setSampleProgress(null);
      await openFile(file);
    } catch (e) {
      setSampleProgress(null);
      toast.error('Não foi possível gerar o vídeo de exemplo', { description: e instanceof Error ? e.message : undefined });
    }
  };

  /* ─── analysis ─── */
  const silencesFor = useCallback((s: EditSettings) => (audio ? detectSilences(audio, s.cutDetection.silenceThresholdDb, s.cutDetection.minSilenceSec) : []), [audio]);

  const redetect = useCallback((s: EditSettings, w: Word[] = rawWords, keepManual = true) => {
    const auto = detectCuts({ words: w, silences: silencesFor(s), duration, config: s.cutDetection });
    setCuts((prev) => mergeCuts([...auto, ...(keepManual ? prev.filter((c) => c.reason === 'manual') : [])], duration));
  }, [rawWords, silencesFor, duration]);

  const analyze = async () => {
    if (!loaded) return;
    setStatus('Transcrevendo o áudio…');
    try {
      const silences = silencesFor(settings);
      const data = await invokeWithRetry<{ words: Word[] }>('video-transcribe', {
        projectId, duration, speech: speechRegions(silences, duration), fileName: loaded.file.name,
      }, { friendlyName: 'Transcrição', projectId, maxRetries: 1 });
      setStatus('Detectando os cortes…');
      const w = Array.isArray(data.words) ? data.words : [];
      setRawWords(w);
      redetect(settings, w, true);
      setAnalyzed(true);
      setTab('texto');
      toast.success('Análise pronta', { description: 'Confira os cortes na transcrição e na timeline.' });
    } catch (e) {
      toast.error('A análise falhou', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setStatus(null);
    }
  };

  /* ─── edits ─── */
  const setSetting = (path: string, value: unknown) => {
    setSettings((s) => {
      const n = structuredClone(s);
      setPath(n as unknown as Record<string, unknown>, path, value);
      return n;
    });
  };
  // detection parameters re-run the detection (debounced)
  const detKey = JSON.stringify(settings.cutDetection);
  const firstDet = useRef(true);
  useEffect(() => {
    if (firstDet.current) { firstDet.current = false; return; }
    if (!analyzed) return;
    const t = setTimeout(() => redetect(settings), 350);
    return () => clearTimeout(t);
  }, [detKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWord = (i: number) => {
    const w = words[i];
    if (!w) return;
    if (w.cut) {
      const mid = (w.start + w.end) / 2;
      setCuts((cs) => cs.map((c) => (c.enabled !== false && mid >= c.start && mid <= c.end ? { ...c, enabled: false } : c)));
    } else {
      const r = wordRegion(rawWords, i);
      setCuts((cs) => mergeCuts([...cs, { id: newCutId('m'), ...r, reason: 'manual', label: `"${w.word}"`, enabled: true }], duration));
    }
  };
  const addCut = (r: Range) => setCuts((cs) => mergeCuts([...cs, { id: newCutId('m'), ...r, reason: 'manual', label: 'Corte manual', enabled: true }], duration));
  const toggleCut = (id: string, on: boolean) => setCuts((cs) => cs.map((c) => (c.id === id ? { ...c, enabled: on } : c)));
  const toggleReason = (r: CutReason, on: boolean) => setCuts((cs) => cs.map((c) => (c.reason === r ? { ...c, enabled: on } : c)));
  const removeCut = (id: string) => setCuts((cs) => cs.filter((c) => c.id !== id));
  const seek = (t: number) => playerRef.current?.seek(t);

  const downloadSrt = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buildSrt(blocks)], { type: 'text/plain;charset=utf-8' }));
    a.download = `${loaded?.file.name.replace(/\.[^.]+$/, '') || 'legendas'}.srt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const grab = async () => {
    const v = playerRef.current?.video();
    if (!v) return;
    setGrabbing(true);
    try {
      setFrames({ before: grabFrame(v), after: grabFrame(v, filter) });
    } catch {
      toast.error('Não foi possível capturar o quadro');
    } finally {
      setGrabbing(false);
    }
  };

  /* ─── Astra ─── */
  const askAstra = async (pedido: string) => {
    setAstraLog((l) => [...l, { from: 'me', text: pedido }]);
    setAstraBusy(true);
    try {
      const data = await invokeWithRetry<{ resposta: string; operacoes: AstraOp[] }>('video-astra', {
        projectId, pedido, settings, duration,
        cortes: cuts.slice(0, 120).map((c) => ({ id: c.id, inicio: +c.start.toFixed(1), fim: +c.end.toFixed(1), motivo: c.reason, ativo: c.enabled !== false })),
        transcricao: rawWords.map((w) => w.word).join(' ').slice(0, 4000),
      }, { friendlyName: 'Astra', projectId, maxRetries: 1, silent: true });
      const r = applyOperations(settings, cuts, data.operacoes ?? [], duration);
      setSettings(r.settings);
      if (r.redetect) {
        const auto = detectCuts({ words: rawWords, silences: silencesFor(r.settings), duration, config: r.settings.cutDetection });
        setCuts(mergeCuts([...auto, ...r.cuts.filter((c) => c.reason === 'manual')], duration));
      } else setCuts(r.cuts);
      setAstraLog((l) => [...l, { from: 'astra', text: data.resposta || 'Feito.', items: r.log }]);
    } catch (e) {
      setAstraLog((l) => [...l, { from: 'erro', text: e instanceof Error ? e.message : 'A Astra não respondeu.' }]);
    } finally {
      setAstraBusy(false);
    }
  };

  /* ─── render (simulated job) ─── */
  const startRender = async () => {
    const steps = RENDER_STEPS(summary.cutCount, settings);
    playerRef.current?.pause();
    for (let i = 0; i < steps.length; i++) {
      setRender({ step: i, steps });
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
    }
    setRender(null);
    setResult(true);
  };

  /* ─── keyboard ─── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!loaded || ['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable || el.getAttribute('role') === 'slider') return;
      if (e.code === 'Space') { e.preventDefault(); playerRef.current?.toggle(); }
      if (e.code === 'ArrowLeft') seek(Math.max(0, time - (e.shiftKey ? 5 : 1)));
      if (e.code === 'ArrowRight') seek(Math.min(duration, time + (e.shiftKey ? 5 : 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ═══════════ empty ═══════════ */
  if (!loaded) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider"><Clapperboard className="h-4 w-4" /> Edição de Vídeo</div>
            <h1 className="text-3xl font-bold">Do bruto ao pronto para postar</h1>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Solte a gravação: a IA transcreve, sugere os cortes de silêncio, vícios e repetições, trata imagem e áudio e gera as legendas. Você revisa tudo antes de renderizar.
            </p>
          </div>

          <button type="button" onClick={() => inputRef.current?.click()} disabled={!!preparing || sampleProgress !== null}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void openFile(f); }}
            className={cn('w-full rounded-3xl border-2 border-dashed px-6 py-14 flex flex-col items-center gap-3 transition-all duration-300 animate-in fade-in zoom-in-95 duration-500',
              dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/50 hover:bg-secondary/30')}>
            <span className={cn('h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_40px_-8px_hsl(var(--primary)/0.8)] transition-transform duration-300', dragOver && '-translate-y-1 scale-105')}>
              {preparing ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
            </span>
            <span className="text-lg font-semibold">{preparing ?? (dragOver ? 'Pode soltar' : 'Solte um vídeo aqui')}</span>
            <span className="text-xs text-muted-foreground">MP4, MOV, MKV ou WEBM · o vídeo não sai do seu computador — só o áudio vai para a transcrição</span>
          </button>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ''; }} />

          {import.meta.env.MODE === 'demo' && (
            <div className="flex flex-col items-center gap-2">
              <Button variant="secondary" size="sm" onClick={makeSample} disabled={sampleProgress !== null || !!preparing} className="gap-1.5">
                {sampleProgress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {sampleProgress !== null ? `Gravando o vídeo de exemplo… ${Math.round(sampleProgress * 100)}%` : 'Gerar vídeo de exemplo (demo)'}
              </Button>
              {sampleProgress !== null && <Progress value={sampleProgress * 100} className="h-1 w-56" />}
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger">
            {[
              { icon: Scissors, t: 'Cortes automáticos', d: 'Silêncios, "eh", "hum", repetições e falsos começos — tudo como sugestão.' },
              { icon: SunMedium, t: 'Imagem e áudio', d: 'Cor, luz, ruído e nitidez; voz limpa com pico final exato.' },
              { icon: Captions, t: 'Legendas', d: 'Palavra a palavra, no estilo da marca, queimadas ou em .SRT.' },
              { icon: Bot, t: 'Astra', d: 'Peça em português: "legenda menor", "corta de 12 a 14 s".' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-4 card-hover">
                <Icon className="h-5 w-5 text-primary" />
                <div className="text-sm font-semibold mt-2">{t}</div>
                <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════ editor ═══════════ */
  const portrait = loaded.probe.height > loaded.probe.width;
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card/50">
        <Film className="h-4 w-4 text-primary flex-none" />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate max-w-[280px]">{loaded.file.name}</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {loaded.probe.width}×{loaded.probe.height} · {fmtTime(summary.originalDuration)}
            {summary.cutCount > 0 && <> → <b className="text-primary">{fmtTime(summary.finalDuration)}</b> · {summary.cutCount} cortes · −{fmtTime(summary.removed)}</>}
          </div>
        </div>
        <div className="flex-1" />
        {status && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-medium animate-in fade-in duration-300">
            <Loader2 className="h-3 w-3 animate-spin" /> {status}
          </span>
        )}
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => inputRef.current?.click()}><RefreshCw className="h-3.5 w-3.5" /> Trocar vídeo</Button>
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ''; }} />
        <Button variant={analyzed ? 'outline' : 'default'} size="sm" className={cn('gap-1.5', !analyzed && 'btn-shine')} onClick={analyze} disabled={!!status}>
          {status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {analyzed ? 'Analisar de novo' : 'Analisar'}
        </Button>
        <Button size="sm" className={cn('gap-1.5', analyzed && 'btn-shine')} variant={analyzed ? 'default' : 'outline'} onClick={startRender} disabled={!!status || !!render}>
          <Clapperboard className="h-3.5 w-3.5" /> Renderizar
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* stage */}
        <div className="min-h-0 flex flex-col bg-[radial-gradient(ellipse_at_center,hsl(0_0%_10%),hsl(0_0%_6%))]">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <Player ref={playerRef} url={loaded.url} probe={loaded.probe} filter={filter} cuts={cuts} keeps={keeps} blocks={blocks}
              captions={settings.captions} skipCuts={skipCuts} onTime={setTime} portrait={portrait} />
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border-t border-white/5">
            <Button size="icon" className="h-9 w-9 rounded-full" onClick={() => playerRef.current?.toggle()}><PlayIcon handle={playerRef} /></Button>
            <span className="text-xs tabular-nums text-muted-foreground">{fmtTime(time)} / {fmtTime(duration)}</span>
            <label className="flex items-center gap-2 text-xs cursor-pointer ml-2">
              <Switch checked={skipCuts} onCheckedChange={setSkipCuts} className="scale-90" /> Pular cortes na prévia
            </label>
            <div className="flex-1" />
            {summary.cutCount > 0 && <span className="text-[11px] text-muted-foreground hidden sm:inline">Espaço: tocar/pausar · ← →: 1 s (Shift: 5 s)</span>}
          </div>
        </div>

        {/* side */}
        <div className="min-h-0 border-l bg-card/40 flex flex-col">
          <div className="p-2 border-b">
            <div className="grid grid-cols-6 gap-0.5 rounded-xl bg-secondary/60 p-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const badge = t.id === 'cortes' && summary.cutCount ? summary.cutCount : null;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
                    className={cn('relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors duration-200', tab === t.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {tab === t.id && <motion.span layoutId="video-tab" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <Icon className="h-3.5 w-3.5 relative" />
                    <span className="relative">{t.label}</span>
                    {badge && <span className={cn('absolute top-0.5 right-1 text-[8px] font-bold rounded-full px-1', tab === t.id ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground')}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div key={tab} className="flex-1 min-h-0 overflow-y-auto p-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {tab === 'texto' && <TranscriptPanel words={words} currentTime={time} onToggle={toggleWord} onSeek={seek} />}
            {tab === 'cortes' && <CutsPanel settings={settings} cuts={cuts} hasAnalysis={analyzed} onSetting={setSetting} onToggle={toggleCut} onToggleReason={toggleReason} onRemove={removeCut} onSeek={seek} onRedetect={() => redetect(settings)} />}
            {tab === 'imagem' && <ImagePanel settings={settings} onSetting={setSetting} suggestion={wbSuggestion} onApplySuggestion={() => wbSuggestion !== null && setSetting('image.whiteBalance', wbSuggestion)} frames={frames} onGrab={grab} grabbing={grabbing} />}
            {tab === 'audio' && <AudioPanel settings={settings} onSetting={setSetting} />}
            {tab === 'legendas' && <CaptionsPanel settings={settings} onSetting={setSetting} onSrt={downloadSrt} hasWords={blocks.length > 0} />}
            {tab === 'astra' && <AstraPanel log={astraLog} busy={astraBusy} onSend={askAstra} />}
          </div>
        </div>
      </div>

      <VideoTimeline duration={duration} peaks={audio?.peaks ?? []} cuts={cuts} currentTime={time} onSeek={seek} onCutRange={addCut} />

      {/* render progress */}
      <Dialog open={!!render}>
        <DialogContent className="max-w-sm [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-primary" /> Renderizando</DialogTitle>
            <DialogDescription>Mesma resolução e frame rate do original.</DialogDescription>
          </DialogHeader>
          {render && (
            <div className="space-y-3">
              <Progress value={((render.step + 1) / render.steps.length) * 100} className="h-1.5" />
              <ol className="space-y-2">
                {render.steps.map((s, i) => (
                  <li key={i} className={cn('flex items-center gap-2 text-xs transition-colors', i > render.step ? 'text-muted-foreground/50' : i === render.step ? 'text-foreground' : 'text-muted-foreground')}>
                    <span className={cn('h-4 w-4 rounded-full flex items-center justify-center flex-none', i < render.step ? 'bg-primary text-primary-foreground' : i === render.step ? 'border-2 border-primary' : 'border')}>
                      {i < render.step ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : i === render.step ? <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> : null}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* result */}
      <Dialog open={result} onOpenChange={setResult}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Vídeo pronto</DialogTitle>
            <DialogDescription>
              {fmtTime(summary.originalDuration)} → <b className="text-foreground">{fmtTime(summary.finalDuration)}</b> · {summary.cutCount} cortes · {blocks.length} legendas
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-[minmax(0,1fr)_220px] gap-4 items-start">
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center h-[52vh]">
              <Player url={loaded.url} probe={loaded.probe} filter={filter} cuts={cuts} keeps={keeps} blocks={blocks}
                captions={settings.captions} skipCuts onTime={() => undefined} portrait={portrait} autoPlay controls />
            </div>
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground leading-relaxed">A prévia acima já toca sem os cortes, com o tratamento de imagem e as legendas.</p>
              <Button variant="outline" className="w-full gap-2" onClick={downloadSrt} disabled={!blocks.length}><Download className="h-4 w-4" /> Baixar .SRT</Button>
              <Button className="w-full gap-2" disabled title="Gerado pelo servidor de render"><Film className="h-4 w-4" /> Baixar MP4</Button>
              {import.meta.env.MODE === 'demo' && (
                <p className="rounded-lg bg-primary/10 text-primary px-2.5 py-2 text-[11px] leading-relaxed">
                  Modo demo: o MP4 final é gerado pelo servidor de render (FFmpeg), que entra quando a ferramenta for para produção.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════ player ═══════════ */

interface PlayerHandle { seek: (t: number) => void; toggle: () => void; pause: () => void; video: () => HTMLVideoElement | null; playing: () => boolean }

interface PlayerProps {
  url: string; probe: Probe; filter: string; cuts: Cut[]; keeps: Range[]; blocks: CaptionBlock[];
  captions: EditSettings['captions']; skipCuts: boolean; onTime: (t: number) => void; portrait: boolean; autoPlay?: boolean; controls?: boolean;
}

/** The preview: plays the original, jumps over active cuts, applies the image look and draws the captions on top. */
const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(p, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [scale, setScale] = useState(0.3);
  const [jumped, setJumped] = useState(false);
  const [, force] = useState(0);
  const propsRef = useRef(p);
  propsRef.current = p;

  useImperativeHandle(ref, () => ({
    seek: (s) => { if (videoRef.current) videoRef.current.currentTime = s; },
    toggle: () => { const v = videoRef.current; if (v) void (v.paused ? v.play() : v.pause()); },
    pause: () => videoRef.current?.pause(),
    video: () => videoRef.current,
    playing: () => !!videoRef.current && !videoRef.current.paused,
  }));

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => setScale(box.clientHeight / (p.probe.height || 1080)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [p.probe.height]);

  // rAF loop while playing (timeupdate is only ~4 Hz: too coarse to skip short cuts)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    let badge: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const { cuts, skipCuts, onTime } = propsRef.current;
      const now = v.currentTime;
      if (skipCuts) {
        const c = cuts.find((x) => x.enabled !== false && now >= x.start && now < x.end - 0.02);
        if (c) {
          v.currentTime = Math.min((v.duration || c.end) - 0.05, c.end + 0.01);
          setJumped(true);
          clearTimeout(badge);
          badge = setTimeout(() => setJumped(false), 450);
        }
      }
      setT(v.currentTime);
      onTime(v.currentTime);
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const onPlay = () => { force((n) => n + 1); raf = requestAnimationFrame(tick); };
    const onPause = () => { force((n) => n + 1); cancelAnimationFrame(raf); tick(); };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', tick);
    v.addEventListener('timeupdate', tick);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(badge);
      v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', tick); v.removeEventListener('timeupdate', tick);
    };
  }, []);

  const inCut = p.cuts.some((c) => c.enabled !== false && t >= c.start && t < c.end);
  const tc = mapTime(t, p.keeps);
  const block = !inCut && p.captions.enabled ? p.blocks.find((b) => tc >= b.start && tc <= b.end) : undefined;
  const c = p.captions;

  return (
    <div ref={boxRef} className={cn('relative max-h-full max-w-full rounded-xl overflow-hidden shadow-2xl bg-black', p.portrait ? 'h-full' : 'w-full')}
      style={{ aspectRatio: `${p.probe.width} / ${p.probe.height}` }}>
      <video ref={videoRef} src={p.url} playsInline autoPlay={p.autoPlay} controls={p.controls}
        className="absolute inset-0 w-full h-full object-contain transition-[filter] duration-300" style={{ filter: p.filter }}
        onClick={() => { const v = videoRef.current; if (v && !p.controls) void (v.paused ? v.play() : v.pause()); }} />
      {block && (
        <div className="pointer-events-none absolute inset-x-[6%] text-center leading-[1.18]"
          style={{
            bottom: `${c.marginBottomPct}%`, fontFamily: `"${c.fontFamily}", "Open Sans", sans-serif`, fontWeight: c.bold ? 800 : 400,
            fontSize: c.fontSizePx * scale, color: c.color, WebkitTextStroke: `${c.outlinePx * scale * 2}px ${c.outlineColor}`, paintOrder: 'stroke fill',
          }}>
          {block.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {jumped && <span className="absolute top-3 right-3 rounded-full bg-destructive/90 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 animate-in fade-in zoom-in-90 duration-150"><Scissors className="h-3 w-3" /> corte</span>}
    </div>
  );
});

function PlayIcon({ handle }: { handle: React.RefObject<PlayerHandle> }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setPlaying(!!handle.current?.playing()), 150);
    return () => clearInterval(iv);
  }, [handle]);
  return playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />;
}

