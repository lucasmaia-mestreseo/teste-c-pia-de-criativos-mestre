import { useEffect, useRef, useState } from 'react';

/**
 * Number that counts up to `value` with an ease-out curve. Starts from the
 * previous value on updates; shows the final number immediately when the user
 * prefers reduced motion (or when animation frames aren't running).
 */
export default function CountUp({ value, duration = 900, format = (n: number) => n.toLocaleString('pt-BR') }: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    // safety net: if frames are paused (background tab), land on the final value
    const done = setTimeout(() => { setShown(value); from.current = value; }, duration + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [value, duration]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
