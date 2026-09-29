/**
 * Edição de Vídeo — the editing engine, ported from the team's local editor
 * ("Editor de Vídeo · Astra": Node + Express + FFmpeg). Everything here is
 * pure and runs in the browser: cut detection over the word transcript and
 * the silences, the kept ranges / time mapping, caption blocks and SRT, and
 * the operations the Astra panel applies. Rendering the final MP4 still needs
 * FFmpeg on a server (see docs/EDICAO-DE-VIDEO.md).
 */

export interface Word { word: string; start: number; end: number; cut?: boolean; cutReason?: CutReason | null }
export interface Silence { start: number; end: number }
export type CutReason = 'silencio' | 'vicio' | 'repeticao' | 'gagueira' | 'manual';
export interface Cut { id: string; start: number; end: number; reason: CutReason; label: string; enabled: boolean }

export interface ImageSettings {
  enabled: boolean; whiteBalance: number; exposure: number; contrast: number; saturation: number;
  shadows: number; highlightProtect: number; denoise: number; sharpen: number;
}
export interface AudioSettings { enabled: boolean; targetPeakDb: number; denoise: number; compress: number; highpassHz: number; presenceDb: number }
export interface CaptionSettings {
  enabled: boolean; fontFamily: string; bold: boolean; fontSizePx: number; color: string; outlineColor: string;
  outlinePx: number; shadowPx: number; maxWordsPerLine: number; maxLines: number; marginBottomPct: number; uppercase: boolean;
}
export interface CutDetectionSettings {
  silenceThresholdDb: number; minSilenceSec: number; paddingSec: number;
  removeFillers: boolean; removeRepeats: boolean; removeStutters: boolean; aggressiveFillers: boolean;
}
export interface EditSettings {
  image: ImageSettings; audio: AudioSettings; captions: CaptionSettings; cutDetection: CutDetectionSettings;
  output: { crf: number; preset: string; burnCaptions: boolean };
}

/** The preset the editor ships with (the values from the original briefing). */
export const DEFAULT_EDIT_SETTINGS: EditSettings = {
  image: { enabled: true, whiteBalance: 0, exposure: 0, contrast: 6, saturation: 2, shadows: 12, highlightProtect: 45, denoise: 20, sharpen: 35 },
  audio: { enabled: true, targetPeakDb: -4, denoise: 30, compress: 40, highpassHz: 80, presenceDb: 3 },
  captions: {
    enabled: true, fontFamily: 'Open Sans', bold: true, fontSizePx: 72, color: '#FFD400', outlineColor: '#000000',
    outlinePx: 9, shadowPx: 0, maxWordsPerLine: 4, maxLines: 2, marginBottomPct: 20, uppercase: false,
  },
  cutDetection: { silenceThresholdDb: -30, minSilenceSec: 0.4, paddingSec: 0.18, removeFillers: true, removeRepeats: true, removeStutters: true, aggressiveFillers: false },
  output: { crf: 18, preset: 'medium', burnCaptions: true },
};

export const REASON_LABELS: Record<CutReason, string> = {
  silencio: 'Silêncio / espaço vazio',
  vicio: 'Vício de linguagem',
  repeticao: 'Palavra ou trecho repetido',
  gagueira: 'Gagueira / falso começo',
  manual: 'Corte manual',
};

/* ─── cut detection ─── */

/** Hesitation sounds. Short on purpose: nothing here is a real word. */
const HESITACOES = new Set(['eh', 'ehh', 'ehhh', 'ah', 'ahh', 'ahhh', 'ahn', 'ahnn', 'an', 'ann', 'hum', 'hmm', 'hm', 'hmmm', 'uhm', 'uh', 'mm', 'mmm', 'ha', 'han', 'hann', 'aham', 'uhum', 'ata']);
/** Crutch words that ARE real words: only with the aggressive mode on. */
const MULETAS = new Set(['ne', 'tipo', 'assim', 'sabe', 'entendeu', 'certo']);

export const normalizeWord = (w: string) => String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]/gi, '').trim();

let seq = 0;
export const newCutId = (p = 'c') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Region around word i, splitting the gaps with its neighbours. */
export function wordRegion(words: Word[], i: number) {
  const w = words[i];
  const prev = words[i - 1];
  const next = words[i + 1];
  const start = prev ? Math.max(w.start - 0.04, (prev.end + w.start) / 2) : Math.max(0, w.start - 0.06);
  const end = next ? Math.min(w.end + 0.04, (w.end + next.start) / 2) : w.end + 0.06;
  return { start, end };
}

export function detectCuts({ words = [], silences = [], duration = 0, config }: { words?: Word[]; silences?: Silence[]; duration?: number; config: CutDetectionSettings }): Cut[] {
  const pad = config.paddingSec ?? 0.18;
  const found: Cut[] = [];

  // 1. silences, keeping a breath at both ends
  for (const s of silences) {
    const start = s.start + pad;
    const end = s.end - pad;
    if (end - start > 0.08) found.push({ id: newCutId(), start, end, reason: 'silencio', label: `Silêncio de ${(s.end - s.start).toFixed(1).replace('.', ',')}s`, enabled: true });
  }

  const norm = words.map((w) => normalizeWord(w.word));

  // 2. filler sounds
  if (config.removeFillers !== false) {
    words.forEach((w, i) => {
      const n = norm[i];
      if (!n || (!HESITACOES.has(n) && !(config.aggressiveFillers && MULETAS.has(n)))) return;
      found.push({ id: newCutId(), ...wordRegion(words, i), reason: 'vicio', label: `"${w.word}"`, enabled: true });
    });
  }

  // 3. repeats: a word, then blocks of 2–6 words (keeps the LAST take)
  if (config.removeRepeats !== false) {
    for (let i = 0; i < words.length - 1; i++) {
      if (!norm[i] || norm[i] !== norm[i + 1]) continue;
      if (words[i + 1].start - words[i].end > 1.2) continue;
      found.push({ id: newCutId(), ...wordRegion(words, i), reason: 'repeticao', label: `"${words[i].word}" repetida`, enabled: true });
    }
    for (let n = 6; n >= 2; n--) {
      for (let i = 0; i + 2 * n <= words.length; i++) {
        const a = norm.slice(i, i + n).join(' ');
        const b = norm.slice(i + n, i + 2 * n).join(' ');
        if (!a || a !== b) continue;
        if (words[i + n].start - words[i + n - 1].end > 1.5) continue;
        found.push({
          id: newCutId(), start: wordRegion(words, i).start, end: wordRegion(words, i + n - 1).end, reason: 'repeticao',
          label: `Trecho repetido: "${words.slice(i, i + n).map((w) => w.word).join(' ')}"`, enabled: true,
        });
        i += 2 * n - 1;
      }
    }
  }

  // 4. stutters / false starts: "pro… produtividade"
  if (config.removeStutters !== false) {
    for (let i = 0; i < words.length - 1; i++) {
      const a = norm[i];
      const b = norm[i + 1];
      if (!a || !b || a === b || a.length < 2 || a.length >= b.length || !b.startsWith(a)) continue;
      if (words[i + 1].start - words[i].end > 0.7) continue;
      found.push({ id: newCutId(), ...wordRegion(words, i), reason: 'gagueira', label: `"${words[i].word}" → "${words[i + 1].word}"`, enabled: true });
    }
  }

  return mergeCuts(found, duration);
}

/**
 * Merges overlapping cuts, keeping the most descriptive reason. Enabled and
 * disabled cuts merge SEPARATELY, or a new cut could vanish inside a disabled one.
 */
export function mergeCuts(cuts: Cut[], duration: number): Cut[] {
  const prio: Record<CutReason, number> = { silencio: 0, vicio: 1, gagueira: 2, repeticao: 3, manual: 4 };
  const fuse = (group: Cut[]) => {
    const out: Cut[] = [];
    for (const c of group) {
      const last = out[out.length - 1];
      if (last && c.start <= last.end + 0.02) {
        last.end = Math.max(last.end, c.end);
        if (prio[c.reason] > prio[last.reason]) { last.reason = c.reason; last.label = c.label; }
        continue;
      }
      out.push({ ...c });
    }
    return out;
  };
  const list = cuts
    .map((c) => ({ ...c, start: Math.max(0, c.start), end: Math.min(duration || c.end, c.end) }))
    .filter((c) => c.end - c.start > 0.03)
    .sort((a, b) => a.start - b.start);
  const on = fuse(list.filter((c) => c.enabled !== false));
  const off = fuse(list.filter((c) => c.enabled === false));
  const covered = (c: Cut) => on.some((a) => c.start >= a.start - 0.02 && c.end <= a.end + 0.02);
  return [...on, ...off.filter((c) => !covered(c))].sort((a, b) => a.start - b.start);
}

/** Which words fall inside an active cut. */
export function markWords(words: Word[], cuts: Cut[]): Word[] {
  const active = cuts.filter((c) => c.enabled !== false);
  return words.map((w) => {
    const mid = (w.start + w.end) / 2;
    const hit = active.find((c) => mid >= c.start && mid <= c.end);
    return { ...w, cut: !!hit, cutReason: hit?.reason ?? null };
  });
}

/* ─── time mapping ─── */

export interface Range { start: number; end: number }

export function keepRanges(duration: number, cuts: Cut[]): Range[] {
  const active = cuts.filter((c) => c.enabled !== false)
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(duration, c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const c of active) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end + 0.001) last.end = Math.max(last.end, c.end);
    else merged.push({ ...c });
  }
  const keeps: Range[] = [];
  let cursor = 0;
  for (const c of merged) {
    if (c.start > cursor + 0.02) keeps.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (duration > cursor + 0.02) keeps.push({ start: cursor, end: duration });
  return keeps;
}

/** Time in the original → time in the cut video. */
export function mapTime(t: number, keeps: Range[]): number {
  let acc = 0;
  for (const k of keeps) {
    if (t < k.start) return acc;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return acc;
}

export const keptDuration = (keeps: Range[]) => keeps.reduce((s, k) => s + (k.end - k.start), 0);

export function summarize(duration: number, cuts: Cut[]) {
  const keeps = keepRanges(duration, cuts);
  const finalDuration = keptDuration(keeps);
  return { originalDuration: duration, finalDuration, removed: duration - finalDuration, cutCount: cuts.filter((c) => c.enabled !== false).length };
}

/* ─── captions ─── */

export interface CaptionBlock { start: number; end: number; words: Word[]; text: string; lines: string[] }

/** Groups the kept words into caption blocks, in the time of the cut video. */
export function buildBlocks(words: Word[], keeps: Range[], captions: CaptionSettings): CaptionBlock[] {
  const perLine = Math.max(1, captions.maxWordsPerLine || 4);
  const maxLines = Math.max(1, captions.maxLines || 2);
  const maxWords = perLine * maxLines;
  const blocks: CaptionBlock[] = [];
  let cur: CaptionBlock | null = null;
  for (const w of words.filter((x) => !x.cut)) {
    const start = mapTime(w.start, keeps);
    const end = mapTime(w.end, keeps);
    if (end <= start) continue;
    const sentenceEnd = cur && /[.!?…]$/.test(cur.words[cur.words.length - 1].word);
    const pause = cur && start - cur.end > 0.45;
    if (!cur || cur.words.length >= maxWords || sentenceEnd || pause) {
      cur = { start, end, words: [{ ...w, start, end }], text: '', lines: [] };
      blocks.push(cur);
    } else {
      cur.words.push({ ...w, start, end });
      cur.end = end;
    }
  }
  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    b.end = Math.max(b.end, b.start + 0.4);
    if (next && b.end > next.start - 0.02) b.end = Math.max(b.start + 0.25, next.start - 0.02);
    const tidy = (s: string) => s.replace(/\s+([,.!?…])/g, '$1');
    b.text = tidy(b.words.map((w) => w.word).join(' '));
    const lines: string[] = [];
    for (let j = 0; j < b.words.length && lines.length < maxLines; j += perLine) lines.push(tidy(b.words.slice(j, j + perLine).map((w) => w.word).join(' ')));
    b.lines = captions.uppercase ? lines.map((l) => l.toUpperCase()) : lines;
    if (captions.uppercase) b.text = b.text.toUpperCase();
  });
  return blocks;
}

const srtTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
export const buildSrt = (blocks: CaptionBlock[]) => blocks.map((b, i) => `${i + 1}\n${srtTime(b.start)} --> ${srtTime(b.end)}\n${b.lines.join('\n')}\n`).join('\n');

/* ─── Astra operations ─── */

export type AstraOp =
  | { tipo: 'ajustar'; caminho: string; valor: unknown }
  | { tipo: 'cortes_por_motivo'; motivo: CutReason; ativo: boolean }
  | { tipo: 'corte_adicionar'; inicio: number; fim: number; rotulo?: string }
  | { tipo: 'corte_remover'; id: string }
  | { tipo: 'redetectar' };

/** Valid paths and their ranges (same contract as the original Astra prompt). */
export const LIMITS: Record<string, [number, number]> = {
  'image.whiteBalance': [-100, 100], 'image.exposure': [-100, 100], 'image.contrast': [-100, 100], 'image.saturation': [-100, 100],
  'image.shadows': [0, 100], 'image.highlightProtect': [0, 100], 'image.denoise': [0, 100], 'image.sharpen': [0, 100],
  'audio.targetPeakDb': [-24, 0], 'audio.denoise': [0, 100], 'audio.compress': [0, 100], 'audio.highpassHz': [0, 200], 'audio.presenceDb': [-12, 12],
  'captions.fontSizePx': [24, 200], 'captions.outlinePx': [0, 30], 'captions.maxWordsPerLine': [1, 8], 'captions.maxLines': [1, 3], 'captions.marginBottomPct': [0, 45],
  'cutDetection.silenceThresholdDb': [-60, -10], 'cutDetection.minSilenceSec': [0.1, 3], 'cutDetection.paddingSec': [0, 1],
  'output.crf': [14, 28],
};
const BOOLEANS = new Set(['captions.uppercase', 'captions.bold', 'captions.enabled', 'cutDetection.removeFillers', 'cutDetection.removeRepeats', 'cutDetection.removeStutters', 'cutDetection.aggressiveFillers', 'output.burnCaptions', 'image.enabled', 'audio.enabled']);
const COLORS = new Set(['captions.color', 'captions.outlineColor']);

export const getPath = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
export function setPath(o: Record<string, unknown>, p: string, v: unknown) {
  const parts = p.split('.');
  let cur = o;
  for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] ??= {}) as Record<string, unknown>;
  cur[parts[parts.length - 1]] = v;
}

/** Applies an Astra plan to settings + cuts. Unknown paths are ignored; one bad op never breaks the rest. */
export function applyOperations(settings: EditSettings, cuts: Cut[], ops: AstraOp[], duration: number) {
  const next = structuredClone(settings);
  let list = cuts.map((c) => ({ ...c }));
  const log: string[] = [];
  let redetect = false;
  for (const op of ops ?? []) {
    try {
      if (op.tipo === 'ajustar') {
        let v = op.valor;
        if (LIMITS[op.caminho]) {
          const [min, max] = LIMITS[op.caminho];
          v = Math.max(min, Math.min(max, Number(v)));
          if (!Number.isFinite(v as number)) continue;
        } else if (BOOLEANS.has(op.caminho)) v = Boolean(v);
        else if (COLORS.has(op.caminho)) { if (!/^#[0-9a-f]{6}$/i.test(String(v))) continue; }
        else continue;
        setPath(next as unknown as Record<string, unknown>, op.caminho, v);
        log.push(`${PATH_LABELS[op.caminho] ?? op.caminho} → ${typeof v === 'boolean' ? (v ? 'sim' : 'não') : v}`);
        if (op.caminho.startsWith('cutDetection.')) redetect = true;
      } else if (op.tipo === 'cortes_por_motivo') {
        let n = 0;
        list = list.map((c) => (c.reason === op.motivo ? (n++, { ...c, enabled: !!op.ativo }) : c));
        log.push(`${n} corte(s) de ${REASON_LABELS[op.motivo]?.toLowerCase() ?? op.motivo} ${op.ativo ? 'ligados' : 'desligados'}`);
      } else if (op.tipo === 'corte_adicionar') {
        const start = Number(op.inicio);
        const end = Number(op.fim);
        if (end > start) {
          list.push({ id: newCutId('m'), start, end, reason: 'manual', label: op.rotulo || 'Corte do Astra', enabled: true });
          log.push(`corte de ${start.toFixed(1)}s a ${end.toFixed(1)}s`);
        }
      } else if (op.tipo === 'corte_remover') {
        const before = list.length;
        list = list.filter((c) => c.id !== op.id);
        if (list.length < before) log.push('corte removido');
      } else if (op.tipo === 'redetectar') {
        redetect = true;
        log.push('cortes redetectados');
      }
    } catch { /* skip */ }
  }
  return { settings: next, cuts: mergeCuts(list, duration), log, redetect };
}

export const PATH_LABELS: Record<string, string> = {
  'image.whiteBalance': 'Balanço de branco', 'image.exposure': 'Exposição', 'image.contrast': 'Contraste', 'image.saturation': 'Saturação',
  'image.shadows': 'Sombras', 'image.highlightProtect': 'Proteger altas luzes', 'image.denoise': 'Ruído da imagem', 'image.sharpen': 'Nitidez',
  'audio.targetPeakDb': 'Pico final', 'audio.denoise': 'Ruído de fundo', 'audio.compress': 'Compressão', 'audio.highpassHz': 'Corte de grave', 'audio.presenceDb': 'Presença',
  'captions.fontSizePx': 'Tamanho da legenda', 'captions.outlinePx': 'Traçado', 'captions.color': 'Cor da legenda', 'captions.outlineColor': 'Cor do traçado',
  'captions.maxWordsPerLine': 'Palavras por linha', 'captions.maxLines': 'Linhas', 'captions.marginBottomPct': 'Margem de baixo', 'captions.uppercase': 'Maiúsculas',
  'captions.bold': 'Negrito', 'captions.enabled': 'Legendas', 'cutDetection.silenceThresholdDb': 'Limiar de silêncio', 'cutDetection.minSilenceSec': 'Silêncio mínimo',
  'cutDetection.paddingSec': 'Respiro', 'output.crf': 'Qualidade (CRF)', 'output.burnCaptions': 'Queimar legendas',
};

/* ─── image preview ─── */

/**
 * CSS approximation of the FFmpeg chain (buildVideoFilters) for the live
 * preview. The final render uses the real filters; this is for judging by eye.
 */
export function cssFilter(img: ImageSettings): string {
  if (!img.enabled) return 'none';
  const c = (v: number) => Math.max(-1, Math.min(1, v / 100));
  const f: string[] = [];
  f.push(`brightness(${(1 + c(img.exposure) * 0.3 + (img.shadows / 100) * 0.06 - (img.highlightProtect / 100) * 0.04).toFixed(3)})`);
  f.push(`contrast(${(1 + c(img.contrast) * 0.35 - (img.shadows / 100) * 0.08).toFixed(3)})`);
  f.push(`saturate(${(1 + c(img.saturation) * 0.6).toFixed(3)})`);
  if (img.whiteBalance > 0) f.push(`sepia(${(c(img.whiteBalance) * 0.28).toFixed(3)})`);
  if (img.whiteBalance < 0) f.push(`hue-rotate(${(c(img.whiteBalance) * -14).toFixed(1)}deg) saturate(${(1 + c(img.whiteBalance) * 0.12).toFixed(3)})`);
  if (img.denoise > 40) f.push(`blur(${((img.denoise - 40) / 60 * 0.4).toFixed(2)}px)`);
  return f.join(' ');
}

/** Gray-world white balance suggestion from the mean RGB of a few frames (same formula as the original). */
export function suggestWhiteBalance(rgb: { r: number; g: number; b: number }): number {
  const avg = (rgb.r + rgb.g + rgb.b) / 3;
  const dev = ((rgb.r - avg) - (rgb.b - avg)) / 255;
  return Math.round(Math.max(-60, Math.min(60, -dev * 260)));
}

export const fmtTime = (t: number) => {
  if (!Number.isFinite(t)) return '0:00';
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};
export const fmtTimeLong = (t: number) => `${fmtTime(t)},${Math.floor((t % 1) * 10)}`;
