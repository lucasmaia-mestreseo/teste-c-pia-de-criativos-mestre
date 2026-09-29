import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Bot, ChevronRight, Download, Eye, Loader2, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  REASON_LABELS, fmtTimeLong, getPath, type Cut, type CutReason, type EditSettings, type Word,
} from '@/video/engine';

type SetSetting = (path: string, value: unknown) => void;

/* ─── controls ─── */

export function SliderRow({ settings, path, label, min, max, step, hint, onChange, suffix }: {
  settings: EditSettings; path: string; label: string; min: number; max: number; step: number; hint?: string; suffix?: string; onChange: SetSetting;
}) {
  const v = Number(getPath(settings, path));
  const fmt = (n: number) => (step < 1 ? n.toFixed(step < 0.1 ? 2 : 1) : String(n)).replace('.', ',');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground rounded-md bg-secondary px-1.5 py-0.5 text-[11px] min-w-[42px] text-center">{fmt(v)}{suffix}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[v]} onValueChange={([n]) => onChange(path, n)} />
      {hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SwitchRow({ settings, path, label, hint, onChange }: { settings: EditSettings; path: string; label: string; hint?: string; onChange: SetSetting }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-[10.5px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={!!getPath(settings, path)} onCheckedChange={(v) => onChange(path, v)} />
    </label>
  );
}

function Group({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/40 p-3.5 space-y-4">
      {(title || action) && <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{title}</span>{action}</div>}
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground leading-relaxed">{children}</div>;
}

/* ─── Transcrição ─── */

export function TranscriptPanel({ words, currentTime, onToggle, onSeek }: { words: Word[]; currentTime: number; onToggle: (i: number) => void; onSeek: (t: number) => void }) {
  const playingRef = useRef<HTMLSpanElement>(null);
  const idx = words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  useEffect(() => { playingRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [idx]);
  if (!words.length) return <Empty>Clique em <b className="text-foreground">Analisar</b> para transcrever o áudio. Cada palavra vira um ponto de edição.</Empty>;
  const cutCount = words.filter((w) => w.cut).length;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Clique numa palavra para cortar ou devolver. <span className="line-through decoration-destructive">Riscado</span> fica fora do vídeo.
        Shift + clique leva o player até ela. <b className="text-foreground">{cutCount}</b> de {words.length} palavras cortadas.
      </p>
      <div className="text-[15px] leading-[2.1] rounded-xl border bg-background/40 p-4">
        {words.map((w, i) => (
          <span key={i}>
            <span ref={i === idx ? playingRef : undefined} title={w.cutReason ? REASON_LABELS[w.cutReason] : 'Clique para cortar'}
              onClick={(e) => (e.shiftKey ? onSeek(w.start) : onToggle(i))}
              className={cn('rounded px-[3px] py-[1px] cursor-pointer transition-colors duration-150',
                w.cut ? 'line-through decoration-2 decoration-destructive/80 text-muted-foreground/50 bg-destructive/10'
                  : 'hover:bg-primary/15',
                i === idx && !w.cut && 'bg-primary text-primary-foreground')}>
              {w.word}
            </span>{' '}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Cortes ─── */

const REASON_DOT: Record<CutReason, string> = { silencio: 'bg-sky-400', vicio: 'bg-amber-400', repeticao: 'bg-fuchsia-400', gagueira: 'bg-orange-400', manual: 'bg-primary' };

export function CutsPanel({ settings, cuts, hasAnalysis, onSetting, onToggle, onToggleReason, onRemove, onSeek, onRedetect }: {
  settings: EditSettings; cuts: Cut[]; hasAnalysis: boolean; onSetting: SetSetting;
  onToggle: (id: string, on: boolean) => void; onToggleReason: (r: CutReason, on: boolean) => void; onRemove: (id: string) => void;
  onSeek: (t: number) => void; onRedetect: () => void;
}) {
  const byReason = new Map<CutReason, { total: number; on: number; secs: number }>();
  for (const c of cuts) {
    const r = byReason.get(c.reason) ?? { total: 0, on: 0, secs: 0 };
    r.total++;
    if (c.enabled !== false) { r.on++; r.secs += c.end - c.start; }
    byReason.set(c.reason, r);
  }
  return (
    <div className="space-y-4">
      {cuts.length === 0 && !hasAnalysis && <Empty>Os cortes sugeridos aparecem aqui depois de <b className="text-foreground">Analisar</b>. Você também pode cortar arrastando na timeline.</Empty>}
      {byReason.size > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {[...byReason.entries()].map(([r, v]) => (
            <button key={r} onClick={() => onToggleReason(r, v.on === 0)}
              className={cn('rounded-xl border p-3 text-left transition-all duration-200', v.on ? 'bg-background/40 hover:border-primary/40' : 'opacity-50 border-dashed')}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold"><span className={cn('h-2 w-2 rounded-full', REASON_DOT[r])} />{REASON_LABELS[r]}</div>
              <div className="mt-1 text-lg font-bold tabular-nums">{v.on}<span className="text-xs font-normal text-muted-foreground">/{v.total}</span></div>
              <div className="text-[10px] text-muted-foreground">−{v.secs.toFixed(1).replace('.', ',')}s · {v.on ? 'clique para devolver' : 'clique para cortar'}</div>
            </button>
          ))}
        </div>
      )}
      {cuts.length > 0 && (
        <div className="rounded-xl border divide-y max-h-[280px] overflow-y-auto">
          {cuts.map((c) => (
            <div key={c.id} className={cn('group flex items-center gap-2 px-3 py-2 text-xs transition-opacity', c.enabled === false && 'opacity-45')}>
              <Switch checked={c.enabled !== false} onCheckedChange={(v) => onToggle(c.id, v)} className="scale-75 -ml-1" />
              <span className={cn('h-1.5 w-1.5 rounded-full flex-none', REASON_DOT[c.reason])} />
              <span className="tabular-nums text-muted-foreground w-[92px] flex-none">{fmtTimeLong(c.start)}–{fmtTimeLong(c.end)}</span>
              <span className="truncate flex-1" title={c.label}>{c.label}</span>
              <button onClick={() => onSeek(Math.max(0, c.start - 0.6))} className="text-muted-foreground hover:text-primary" title="Ir para o ponto"><ChevronRight className="h-3.5 w-3.5" /></button>
              <button onClick={() => onRemove(c.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Apagar corte"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      <Group title="Detecção" action={<Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={onRedetect} disabled={!hasAnalysis}><RefreshCw className="h-3 w-3" /> Redetectar</Button>}>
        <SliderRow settings={settings} path="cutDetection.silenceThresholdDb" label="Limiar de silêncio" min={-60} max={-10} step={1} suffix=" dB" hint="Quanto mais perto de 0, mais coisa vira silêncio." onChange={onSetting} />
        <SliderRow settings={settings} path="cutDetection.minSilenceSec" label="Silêncio mínimo" min={0.1} max={3} step={0.05} suffix=" s" onChange={onSetting} />
        <SliderRow settings={settings} path="cutDetection.paddingSec" label="Respiro por corte" min={0} max={1} step={0.01} suffix=" s" hint="Abaixo de 0,15 s o corte fica sufocado." onChange={onSetting} />
        <SwitchRow settings={settings} path="cutDetection.removeFillers" label="Vícios de linguagem" hint='"eh", "ahn", "hum"…' onChange={onSetting} />
        <SwitchRow settings={settings} path="cutDetection.removeRepeats" label="Repetições" hint="Mantém a última tomada" onChange={onSetting} />
        <SwitchRow settings={settings} path="cutDetection.removeStutters" label="Gagueiras" hint='"pro… produtividade"' onChange={onSetting} />
        <SwitchRow settings={settings} path="cutDetection.aggressiveFillers" label='Incluir "né", "tipo", "assim", "sabe"' hint="São palavras reais: o corte automático erra mais" onChange={onSetting} />
      </Group>
    </div>
  );
}

/* ─── Imagem ─── */

export function ImagePanel({ settings, onSetting, suggestion, onApplySuggestion, frames, onGrab, grabbing }: {
  settings: EditSettings; onSetting: SetSetting; suggestion: number | null; onApplySuggestion: () => void;
  frames: { before: string; after: string } | null; onGrab: () => void; grabbing: boolean;
}) {
  return (
    <div className="space-y-4">
      {suggestion !== null && Math.abs(suggestion) >= 8 && settings.image.whiteBalance !== suggestion && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
          <Wand2 className="h-4 w-4 text-primary flex-none" />
          <span className="flex-1">A cena está {suggestion < 0 ? 'puxando para o amarelo' : 'puxando para o azul'}. Sugestão: balanço de branco em <b>{suggestion}</b>.</span>
          <Button size="sm" className="h-7 text-xs" onClick={onApplySuggestion}>Aplicar</Button>
        </div>
      )}
      <Group>
        <SwitchRow settings={settings} path="image.enabled" label="Tratar imagem" onChange={onSetting} />
        <SliderRow settings={settings} path="image.whiteBalance" label="Balanço de branco" min={-100} max={100} step={1} hint="frio ← → quente" onChange={onSetting} />
        <SliderRow settings={settings} path="image.exposure" label="Exposição" min={-100} max={100} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="image.contrast" label="Contraste" min={-100} max={100} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="image.saturation" label="Saturação" min={-100} max={100} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="image.shadows" label="Levantar sombras" min={0} max={100} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="image.highlightProtect" label="Proteger altas luzes" min={0} max={100} step={1} hint="Segura o branco para não estourar." onChange={onSetting} />
        <SliderRow settings={settings} path="image.denoise" label="Reduzir ruído" min={0} max={100} step={1} hint="Roda antes da nitidez, de propósito." onChange={onSetting} />
        <SliderRow settings={settings} path="image.sharpen" label="Nitidez" min={0} max={100} step={1} hint="Sutil: abaixo de 50, como pele deve ficar." onChange={onSetting} />
      </Group>
      <Button variant="outline" className="w-full gap-2" onClick={onGrab} disabled={grabbing}>
        {grabbing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Conferir quadro (antes × depois)
      </Button>
      {frames && (
        <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-300">
          {[['antes', frames.before], ['depois', frames.after]].map(([l, src]) => (
            <figure key={l} className="space-y-1">
              <img src={src} alt={l} className="rounded-lg border w-full" />
              <figcaption className="text-[10px] text-center text-muted-foreground uppercase tracking-wide">{l}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="text-[10.5px] text-muted-foreground">A prévia aproxima o tratamento no navegador; o render final aplica os filtros do FFmpeg.</p>
    </div>
  );
}

/* ─── Áudio ─── */

export function AudioPanel({ settings, onSetting }: { settings: EditSettings; onSetting: SetSetting }) {
  return (
    <div className="space-y-4">
      <Group>
        <SwitchRow settings={settings} path="audio.enabled" label="Tratar áudio" onChange={onSetting} />
        <SliderRow settings={settings} path="audio.targetPeakDb" label="Pico final" min={-24} max={0} step={0.5} suffix=" dB" hint="Medido e ajustado no render: o valor daqui é o que sai no arquivo." onChange={onSetting} />
        <SliderRow settings={settings} path="audio.denoise" label="Reduzir ruído de fundo" min={0} max={100} step={1} hint="Chiado, ar-condicionado, ruído de sala." onChange={onSetting} />
        <SliderRow settings={settings} path="audio.compress" label="Compressão da voz" min={0} max={100} step={1} hint="Uniformiza frases faladas alto e baixo." onChange={onSetting} />
        <SliderRow settings={settings} path="audio.highpassHz" label="Corte de grave" min={0} max={200} step={5} suffix=" Hz" onChange={onSetting} />
        <SliderRow settings={settings} path="audio.presenceDb" label="Presença 4 kHz" min={-12} max={12} step={0.5} suffix=" dB" hint="Clareza da fala." onChange={onSetting} />
      </Group>
    </div>
  );
}

/* ─── Legendas ─── */

export function CaptionsPanel({ settings, onSetting, onSrt, hasWords }: { settings: EditSettings; onSetting: SetSetting; onSrt: () => void; hasWords: boolean }) {
  const c = settings.captions;
  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden border h-24 flex items-center justify-center bg-[linear-gradient(135deg,#2a2f3a,#15171c)]">
        <span style={{
          fontFamily: `"${c.fontFamily}", "Open Sans", sans-serif`, fontWeight: c.bold ? 800 : 400, fontSize: Math.max(12, c.fontSizePx * 0.34),
          color: c.color, WebkitTextStroke: `${Math.max(0, c.outlinePx * 0.34)}px ${c.outlineColor}`, paintOrder: 'stroke fill',
        }}>{c.uppercase ? 'EXEMPLO DE LEGENDA' : 'exemplo de legenda'}</span>
      </div>
      <Group>
        <SwitchRow settings={settings} path="captions.enabled" label="Gerar legendas" onChange={onSetting} />
        <SwitchRow settings={settings} path="output.burnCaptions" label="Queimar no vídeo" hint="Desligado, sai só o .SRT" onChange={onSetting} />
        <div className="space-y-1.5">
          <span className="text-xs font-medium">Fonte</span>
          <Input value={c.fontFamily} onChange={(e) => onSetting('captions.fontFamily', e.target.value)} className="h-8 text-xs bg-secondary" />
        </div>
        <SwitchRow settings={settings} path="captions.bold" label="Negrito" onChange={onSetting} />
        <SwitchRow settings={settings} path="captions.uppercase" label="Tudo em maiúsculas" onChange={onSetting} />
        <div className="grid grid-cols-2 gap-3">
          {(['color', 'outlineColor'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="color" value={c[k]} onChange={(e) => onSetting(`captions.${k}`, e.target.value.toUpperCase())} className="h-8 w-8 rounded-md border bg-transparent p-0.5 cursor-pointer" />
              <span className="font-medium">{k === 'color' ? 'Texto' : 'Traçado'}<span className="block text-[10px] text-muted-foreground font-mono">{c[k]}</span></span>
            </label>
          ))}
        </div>
        <SliderRow settings={settings} path="captions.fontSizePx" label="Tamanho" min={24} max={200} step={2} suffix=" px" onChange={onSetting} />
        <SliderRow settings={settings} path="captions.outlinePx" label="Traçado" min={0} max={30} step={1} suffix=" px" onChange={onSetting} />
        <SliderRow settings={settings} path="captions.maxWordsPerLine" label="Palavras por linha" min={1} max={8} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="captions.maxLines" label="Linhas" min={1} max={3} step={1} onChange={onSetting} />
        <SliderRow settings={settings} path="captions.marginBottomPct" label="Margem de baixo" min={0} max={45} step={1} suffix="%" onChange={onSetting} />
      </Group>
      <Button variant="outline" className="w-full gap-2" onClick={onSrt} disabled={!hasWords}><Download className="h-4 w-4" /> Baixar .SRT</Button>
    </div>
  );
}

/* ─── Astra ─── */

export interface AstraMsg { from: 'me' | 'astra' | 'erro'; text: string; items?: string[] }

const SUGGESTIONS = ['Tira os cortes de vício de linguagem', 'Legenda menor, traçado de 5 px, tudo em maiúsculas', 'A imagem está amarelada, esfria um pouco e aumenta a nitidez', 'Corta de 12 a 14 segundos', 'Silêncio mínimo de 0,6 segundo'];

export function AstraPanel({ log, busy, onSend }: { log: AstraMsg[]; busy: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [log.length, busy]);
  const send = (t = text) => { if (!t.trim() || busy) return; onSend(t.trim()); setText(''); };
  return (
    <div className="flex flex-col h-full min-h-[420px]">
      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        <div className="flex gap-2.5">
          <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-none"><Bot className="h-4 w-4" /></span>
          <div className="rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-xs leading-relaxed">
            Oi! Sou a <b>Astra</b>. Escreva em português o que quer mudar e eu aplico na hora — só mexo no que você pedir, e nada é renderizado sem você.
          </div>
        </div>
        {log.map((m, i) => (
          <div key={i} className={cn('flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300', m.from === 'me' && 'justify-end')}>
            {m.from !== 'me' && <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-none"><Bot className="h-4 w-4" /></span>}
            <div className={cn('rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%]',
              m.from === 'me' ? 'bg-primary text-primary-foreground rounded-tr-sm' : m.from === 'erro' ? 'bg-destructive/15 text-destructive rounded-tl-sm' : 'bg-secondary rounded-tl-sm')}>
              {m.text}
              {m.items && m.items.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {m.items.map((it, j) => <li key={j} className="flex gap-1.5"><Sparkles className="h-3 w-3 text-primary flex-none mt-0.5" />{it}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5 animate-in fade-in duration-200">
            <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-none"><Bot className="h-4 w-4" /></span>
            <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {log.length === 0 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors text-left">{s}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="relative">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="O que você quer ajustar?"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="text-xs bg-secondary resize-none pr-11 min-h-[64px]" />
        <Button type="submit" size="icon" disabled={!text.trim() || busy} className="absolute right-2 bottom-2 h-7 w-7 rounded-full">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
        </Button>
      </form>
    </div>
  );
}
