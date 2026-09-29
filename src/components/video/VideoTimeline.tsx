import { useCallback, useEffect, useRef, useState } from 'react';
import { Scissors, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { fmtTime, type Cut, type Range } from '@/video/engine';

interface Props {
  duration: number;
  peaks: number[];
  cuts: Cut[];
  currentTime: number;
  onSeek: (t: number) => void;
  onCutRange: (r: Range) => void;
}

/** Waveform + cuts + ruler. Click to seek, drag to select a stretch and cut it. */
export default function VideoTimeline({ duration, peaks, cuts, currentTime, onSeek, onCutRange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<Range | null>(null);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cssW = Math.max(width, width * zoom);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !duration || !cssW) return;
    const dpr = window.devicePixelRatio || 1;
    const cssH = wrap.clientHeight;
    canvas.style.width = `${cssW}px`;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const x = (t: number) => (t / duration) * cssW;
    const rulerH = 22;
    const top = rulerH + 6;
    const h = cssH - top - 8;
    const mid = top + h / 2;

    // ruler
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, cssW, rulerH);
    const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((o) => (o / duration) * cssW >= 90) ?? 600;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    for (let t = 0; t <= duration; t += step) {
      const px = Math.round(x(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, rulerH); ctx.stroke();
      ctx.fillText(fmtTime(t), px + 4, 14);
    }

    // waveform (brand yellow, soft)
    if (peaks.length) {
      const grad = ctx.createLinearGradient(0, top, 0, top + h);
      grad.addColorStop(0, 'hsla(58, 100%, 67%, 0.85)');
      grad.addColorStop(0.5, 'hsla(58, 100%, 67%, 0.55)');
      grad.addColorStop(1, 'hsla(58, 100%, 67%, 0.85)');
      ctx.fillStyle = grad;
      const pw = cssW / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const ph = Math.max(1, Math.min(1, peaks[i] * 1.6) * h * 0.92);
        ctx.fillRect(i * pw, mid - ph / 2, Math.max(1, pw - (pw > 3 ? 1 : 0)), ph);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, mid - 1.5, cssW, 3);
    }

    // cuts on top
    for (const c of cuts) {
      const on = c.enabled !== false;
      ctx.fillStyle = on ? 'rgba(239,68,68,0.38)' : 'rgba(148,163,184,0.12)';
      ctx.fillRect(x(c.start), top, Math.max(1, x(c.end) - x(c.start)), h);
      if (on) {
        ctx.fillStyle = 'rgba(239,68,68,0.95)';
        ctx.fillRect(x(c.start), top, 1.5, h);
        ctx.fillRect(x(c.end) - 1.5, top, 1.5, h);
      }
    }
  }, [duration, peaks, cuts, cssW]);

  // keep the playhead in view when zoomed
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || zoom <= 1 || !duration) return;
    const px = (currentTime / duration) * cssW;
    if (px < wrap.scrollLeft + 40 || px > wrap.scrollLeft + wrap.clientWidth - 40) wrap.scrollLeft = px - wrap.clientWidth / 3;
  }, [currentTime, zoom, duration, cssW]);

  const timeAt = useCallback((clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }, [duration]);

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) setSel((s) => (s ? { ...s, end: timeAt(e.clientX) } : s)); };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setSel((s) => {
        if (s && Math.abs(s.end - s.start) < 0.08) { onSeek(s.start); return null; }
        return s;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [timeAt, onSeek]);

  const selLeft = sel ? (Math.min(sel.start, sel.end) / duration) * cssW : 0;
  const selW = sel ? (Math.abs(sel.end - sel.start) / duration) * cssW : 0;
  const hasSel = !!sel && Math.abs(sel.end - sel.start) >= 0.08;

  return (
    <div className="border-t bg-card/60 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs font-semibold">Timeline</span>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">clique para ir ao ponto · arraste para selecionar</span>
        <Button size="sm" variant={hasSel ? 'default' : 'outline'} disabled={!hasSel} className="h-7 text-xs gap-1.5 transition-all"
          onClick={() => { if (sel) { onCutRange({ start: Math.min(sel.start, sel.end), end: Math.max(sel.start, sel.end) }); setSel(null); } }}>
          <Scissors className="h-3.5 w-3.5" /> Cortar seleção{hasSel && sel ? ` (${Math.abs(sel.end - sel.start).toFixed(1).replace('.', ',')}s)` : ''}
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 w-40">
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider min={1} max={12} step={0.5} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
        </div>
      </div>
      <div ref={wrapRef} className="relative h-28 overflow-x-auto overflow-y-hidden no-scrollbar cursor-crosshair select-none"
        onMouseDown={(e) => { if (!duration) return; dragging.current = true; const t = timeAt(e.clientX); setSel({ start: t, end: t }); }}>
        <canvas ref={canvasRef} className="block h-full" />
        <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
          style={{ left: duration ? (currentTime / duration) * cssW : 0 }}>
          <span className="absolute -top-0 -left-[5px] h-3 w-3 rotate-45 bg-primary rounded-[2px]" />
        </div>
        {sel && selW > 0 && (
          <div className="pointer-events-none absolute top-0 bottom-0 bg-primary/15 border-x-2 border-primary/80" style={{ left: selLeft, width: selW }} />
        )}
      </div>
    </div>
  );
}
