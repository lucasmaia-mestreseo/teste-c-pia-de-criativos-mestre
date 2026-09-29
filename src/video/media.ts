/**
 * Edição de Vídeo — what the original editor did with ffprobe/ffmpeg on the
 * server, done in the browser for the preview: probe, waveform peaks, the
 * loudness envelope (for silence detection) and mean frame color (for the
 * white-balance suggestion). The file never leaves the computer.
 */
import type { Silence } from './engine';

export interface Probe { duration: number; width: number; height: number }

export interface AudioAnalysis {
  /** 0..1 peaks for the timeline. */
  peaks: number[];
  /** dBFS of each 20 ms window, used to (re)detect silences with any threshold. */
  envelopeDb: Float32Array;
  windowSec: number;
}

export function probeVideo(url: string): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) { resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }); return; }
      // MediaRecorder WebM has no duration in the header: seeking far makes the browser find it
      v.ondurationchange = () => {
        if (!Number.isFinite(v.duration)) return;
        v.ondurationchange = null;
        resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      };
      v.currentTime = 1e7;
    };
    v.onerror = () => reject(new Error('O navegador não conseguiu abrir esse vídeo. Se for HEVC (câmera/iPhone), converta para H.264 ou use o Edge.'));
    v.src = url;
  });
}

/** Decodes the audio track. Big files are skipped (the timeline falls back to a flat line). */
export async function analyzeAudio(file: File, buckets = 2400): Promise<AudioAnalysis | null> {
  if (file.size > 600 * 1024 * 1024) return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch = buf.getChannelData(0);
    const ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const n = ch.length;

    const peaks = new Array<number>(buckets).fill(0);
    const per = Math.max(1, Math.floor(n / buckets));
    for (let b = 0; b < buckets; b++) {
      let m = 0;
      const end = Math.min(n, (b + 1) * per);
      for (let i = b * per; i < end; i += 4) {
        const v = Math.abs(ch2 ? (ch[i] + ch2[i]) / 2 : ch[i]);
        if (v > m) m = v;
      }
      peaks[b] = Math.round(m * 1000) / 1000;
    }

    const windowSec = 0.02;
    const win = Math.max(1, Math.floor(buf.sampleRate * windowSec));
    const envelopeDb = new Float32Array(Math.ceil(n / win));
    for (let w = 0; w < envelopeDb.length; w++) {
      let sum = 0;
      let cnt = 0;
      const end = Math.min(n, (w + 1) * win);
      for (let i = w * win; i < end; i += 2) { const v = ch2 ? (ch[i] + ch2[i]) / 2 : ch[i]; sum += v * v; cnt++; }
      const rms = Math.sqrt(sum / Math.max(1, cnt));
      envelopeDb[w] = rms > 0 ? 20 * Math.log10(rms) : -120;
    }
    return { peaks, envelopeDb, windowSec };
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

/** Same idea as ffmpeg's silencedetect: stretches below the threshold longer than minDur. */
export function detectSilences(a: AudioAnalysis, thresholdDb: number, minDur: number): Silence[] {
  const out: Silence[] = [];
  let start = -1;
  const env = a.envelopeDb;
  for (let i = 0; i <= env.length; i++) {
    const quiet = i < env.length && env[i] < thresholdDb;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      const s = start * a.windowSec;
      const e = i * a.windowSec;
      if (e - s >= minDur) out.push({ start: s, end: e });
      start = -1;
    }
  }
  return out;
}

/** Speech = everything that isn't silence (used to place words in the demo transcript). */
export function speechRegions(silences: Silence[], duration: number): Silence[] {
  const out: Silence[] = [];
  let cur = 0;
  for (const s of silences) {
    if (s.start - cur > 0.3) out.push({ start: cur, end: s.start });
    cur = s.end;
  }
  if (duration - cur > 0.3) out.push({ start: cur, end: duration });
  return out;
}

/** Mean RGB of a few frames around the first third (gray-world white balance). */
export async function meanFrameColor(url: string, duration: number): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('frame')); });
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    let r = 0, g = 0, b = 0, px = 0;
    for (const f of [0.3, 0.36, 0.42]) {
      v.currentTime = Math.min(duration - 0.1, duration * f);
      await new Promise<void>((res) => { v.onseeked = () => res(); setTimeout(res, 1500); });
      ctx.drawImage(v, 0, 0, 64, 64);
      const d = ctx.getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; px++; }
    }
    v.removeAttribute('src');
    return px ? { r: r / px, g: g / px, b: b / px } : null;
  } catch {
    return null;
  }
}

/** One frame of the <video> at its current time, raw or with a CSS filter (for "antes × depois"). */
export function grabFrame(video: HTMLVideoElement, filter = 'none'): string {
  const w = Math.min(640, video.videoWidth || 640);
  const h = Math.round(w * ((video.videoHeight || 360) / (video.videoWidth || 640)));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.filter = filter;
  ctx.drawImage(video, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.86);
}
