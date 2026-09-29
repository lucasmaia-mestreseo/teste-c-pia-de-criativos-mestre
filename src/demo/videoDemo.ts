/**
 * MODO DEMO — Edição de Vídeo: simulated transcription and Astra, plus a
 * generated sample video. The real editor transcribes with Whisper (word
 * timestamps) and plans edits with an LLM; here a scripted talk is laid over
 * the REAL speech regions of the uploaded audio, so silences and word cuts
 * still line up with what you hear.
 */

type Region = { start: number; end: number };
type Word = { word: string; start: number; end: number };

/** A short talk with the problems the editor is built to catch. */
const SCRIPT = [
  'Oi, eh, eu sou a Tatiana e hoje eu vou te mostrar como organizar a sua semana.',
  'A gente a gente perde muito tempo com tarefas que não geram resultado.',
  'Então o primeiro passo é, hum, listar tudo o que você faz.',
  'O mais importante é o mais importante é separar o urgente do importante.',
  'Com isso a sua pro produtividade dobra em poucas semanas.',
  'Ahn, e no final do dia sobra tempo para o que realmente importa.',
  'Salva esse vídeo e compartilha com quem precisa ouvir isso.',
  'Na próxima semana eu trago o método completo, com a planilha pronta.',
];

export function demoTranscribe(duration: number, speech: Region[]): { words: Word[]; text: string } {
  let regions = speech.filter((r) => r.end - r.start > 0.4);
  if (!regions.length) {
    // no readable audio: alternate talk and pauses over the whole video
    regions = [];
    let t = 0.4;
    let i = 0;
    while (t < duration - 1) {
      const len = Math.min(duration - t - 0.3, 2.4 + ((i * 7) % 5) * 0.6);
      regions.push({ start: t, end: t + len });
      t += len + 0.5 + ((i * 3) % 4) * 0.35;
      i++;
    }
  }
  const tokens = SCRIPT.join(' ').split(/\s+/);
  const words: Word[] = [];
  let k = 0;
  for (const r of regions) {
    let t = r.start + 0.05;
    while (t < r.end - 0.15) {
      const w = tokens[k % tokens.length].replace(/,$/, ',');
      const clean = w.replace(/[^\p{L}]/gu, '');
      const dur = Math.min(0.62, 0.13 + clean.length * 0.043);
      if (t + dur > r.end) break;
      words.push({ word: w, start: +t.toFixed(3), end: +(t + dur).toFixed(3) });
      t += dur + 0.07 + (/[,.]$/.test(w) ? 0.12 : 0);
      k++;
    }
  }
  return { words, text: words.map((w) => w.word).join(' ') };
}

/* ─── Astra (rule-based stand-in for the LLM) ─── */

type Op = Record<string, unknown>;
interface State { settings: Record<string, Record<string, unknown>>; duration: number }

const COLORS: [string, string, string][] = [
  ['amarel', '#FFD400', 'amarela'], ['branc', '#FFFFFF', 'branca'], ['pret', '#000000', 'preta'], ['vermelh', '#FF3B30', 'vermelha'],
  ['azul', '#2F80ED', 'azul'], ['verde', '#27AE60', 'verde'], ['rosa', '#FF4FA3', 'rosa'], ['laranja', '#FF8A00', 'laranja'],
];
const num = (s: string) => Number(s.replace(',', '.'));
const REASONS: [RegExp, string][] = [[/v[íi]cio/, 'vicio'], [/sil[êe]ncio|pausa|espa[çc]o vazio/, 'silencio'], [/repeti/, 'repeticao'], [/gaguei|falso come/, 'gagueira']];

export function demoAstra(pedido: string, state: State): { resposta: string; operacoes: Op[] } {
  const p = pedido.toLowerCase();
  const ops: Op[] = [];
  const said: string[] = [];
  const cur = (path: string) => Number(path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], state.settings));
  const adjust = (caminho: string, valor: unknown, what: string) => { ops.push({ tipo: 'ajustar', caminho, valor }); said.push(what); };

  // cuts by reason
  for (const [re, motivo] of REASONS) {
    if (!re.test(p)) continue;
    if (/(tira|remove|desliga|sem |corta|elimina)/.test(p) && !/(devolve|mant[ée]m|volta|liga )/.test(p)) { ops.push({ tipo: 'cortes_por_motivo', motivo, ativo: true }); said.push(`cortei os ${motivo === 'vicio' ? 'vícios de linguagem' : motivo === 'silencio' ? 'silêncios' : motivo === 'repeticao' ? 'trechos repetidos' : 'falsos começos'}`); }
    if (/(devolve|mant[ée]m|volta|n[ãa]o corta|desfaz)/.test(p)) { ops.push({ tipo: 'cortes_por_motivo', motivo, ativo: false }); said.push(`devolvi os ${motivo === 'vicio' ? 'vícios de linguagem' : motivo === 'silencio' ? 'silêncios' : motivo === 'repeticao' ? 'trechos repetidos' : 'falsos começos'} ao vídeo`); }
  }

  // "corta de 12 a 14 segundos"
  const range = p.match(/cort\w*\s+(?:de|do)\s+(\d+(?:[.,]\d+)?)\s*(?:s|seg\w*)?\s*(?:a|at[ée]|ao)\s+(\d+(?:[.,]\d+)?)/);
  if (range) {
    const a = num(range[1]);
    const b = num(range[2]);
    if (b > a && a < state.duration) { ops.push({ tipo: 'corte_adicionar', inicio: a, fim: Math.min(b, state.duration), rotulo: `Pedido: ${a}s a ${b}s` }); said.push(`cortei de ${range[1]}s a ${range[2]}s`); }
  }

  // captions
  if (/legenda/.test(p)) {
    const size = p.match(/(?:tamanho|fonte|legenda)[^\d]{0,12}(\d{2,3})\s*(?:px)?/);
    if (/(sem legenda|tira (a )?legenda|desliga (a )?legenda)/.test(p)) adjust('captions.enabled', false, 'desliguei as legendas');
    else if (size && !/tra[çc]/.test(p.slice(p.indexOf(size[0]) - 12, p.indexOf(size[0])))) adjust('captions.fontSizePx', Number(size[1]), `legenda em ${size[1]} px`);
    else if (/menor|diminui/.test(p)) adjust('captions.fontSizePx', cur('captions.fontSizePx') - 12, 'diminuí a legenda');
    else if (/maior|aumenta/.test(p)) adjust('captions.fontSizePx', cur('captions.fontSizePx') + 12, 'aumentei a legenda');
    for (const [k, hex, label] of COLORS) {
      // "legenda amarela", "legenda em branco", "cor branca" — not "a imagem está amarelada"
      if (new RegExp(`(legenda|letra|texto|cor)\\s+(?:em\\s+|na\\s+cor\\s+)?${k}(?!ad)`).test(p)) { adjust('captions.color', hex, `legenda ${label}`); break; }
    }
  }
  const outline = p.match(/(?:tra[çc]ado|contorno|borda)[^\d]{0,10}(\d{1,2})\s*px?/);
  if (outline) adjust('captions.outlinePx', Number(outline[1]), `traçado de ${outline[1]} px`);
  else if (/sem (tra[çc]ado|contorno)/.test(p)) adjust('captions.outlinePx', 0, 'tirei o traçado');
  if (/mai[úu]scula/.test(p)) adjust('captions.uppercase', !/(sem|tira|min[úu]scula)/.test(p), /(sem|tira)/.test(p) ? 'legenda sem maiúsculas' : 'legenda em maiúsculas');
  const perLine = p.match(/(\d)\s*palavras? por linha/);
  if (perLine) adjust('captions.maxWordsPerLine', Number(perLine[1]), `${perLine[1]} palavras por linha`);

  // image
  if (/(amarelad|quente demais|esfria|mais fri)/.test(p)) adjust('image.whiteBalance', cur('image.whiteBalance') - 20, 'esfriei a imagem');
  else if (/(azulad|fria demais|esquenta|mais quente)/.test(p)) adjust('image.whiteBalance', cur('image.whiteBalance') + 20, 'esquentei a imagem');
  if (/nitidez|n[íi]tid/.test(p)) adjust('image.sharpen', cur('image.sharpen') + (/(menos|diminui|tira)/.test(p) ? -15 : 15), /(menos|diminui|tira)/.test(p) ? 'menos nitidez' : 'mais nitidez');
  if (/(escur[oa] demais|clareia|mais clar|exposi)/.test(p)) adjust('image.exposure', cur('image.exposure') + (/(escurece|menos exposi)/.test(p) ? -12 : 12), 'ajustei a exposição');
  else if (/escurece/.test(p)) adjust('image.exposure', cur('image.exposure') - 12, 'escureci a imagem');
  if (/contraste/.test(p)) adjust('image.contrast', cur('image.contrast') + (/(menos|diminui)/.test(p) ? -12 : 12), 'ajustei o contraste');
  if (/(satura|mais cor|cores? mais viv)/.test(p)) adjust('image.saturation', cur('image.saturation') + (/(menos|diminui|lavad)/.test(p) ? -12 : 12), 'ajustei a saturação');
  if (/estour|queimad|altas luzes/.test(p)) adjust('image.highlightProtect', cur('image.highlightProtect') + 20, 'protegi as altas luzes');

  // audio
  const peak = p.match(/(?:pico|volume)[^\d-]{0,12}(-?\d+(?:[.,]\d)?)\s*db/);
  if (peak) adjust('audio.targetPeakDb', -Math.abs(num(peak[1])), `pico final em −${Math.abs(num(peak[1]))} dB`);
  if (/ru[íi]do|chiado|ar[- ]condicionado/.test(p)) adjust('audio.denoise', cur('audio.denoise') + 20, 'reduzi o ruído de fundo');
  if (/voz (mais )?presente|clareza|abafad/.test(p)) adjust('audio.presenceDb', cur('audio.presenceDb') + 2, 'mais presença na voz');

  // detection parameters
  const minSil = p.match(/sil[êe]ncio m[íi]nimo[^\d]{0,8}(\d+(?:[.,]\d+)?)/);
  if (minSil) { adjust('cutDetection.minSilenceSec', num(minSil[1]), `silêncio mínimo de ${minSil[1]} s`); ops.push({ tipo: 'redetectar' }); }
  if (/muleta|agressiv|["“]n[ée]["”]|["“]tipo["”]/.test(p)) { adjust('cutDetection.aggressiveFillers', true, 'incluí "né", "tipo", "assim"'); ops.push({ tipo: 'redetectar' }); }
  const crf = p.match(/crf\s*(\d{2})/);
  if (crf) adjust('output.crf', Number(crf[1]), `CRF ${crf[1]}`);

  if (!ops.length) {
    return {
      resposta: 'Não entendi o que mudar. No modo demo eu entendo pedidos como: "tira os vícios de linguagem", "legenda menor, traçado de 5 px", "a imagem está amarelada", "corta de 12 a 14 segundos".',
      operacoes: [],
    };
  }
  const first = said[0].charAt(0).toUpperCase() + said[0].slice(1);
  return { resposta: `${[first, ...said.slice(1)].join(', ')}.`, operacoes: ops };
}

/* ─── sample video ─── */

/**
 * Records a ~15 s sample (canvas + synthesized "voice" with pauses) so the
 * editor can be presented without a real file. Takes as long as the clip.
 */
export async function makeSampleVideo(onProgress?: (p: number) => void): Promise<File> {
  const W = 720, H = 1280, SEC = 15;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const ac = new AudioContext();
  await ac.resume().catch(() => undefined);
  const dest = ac.createMediaStreamDestination();

  // "speech": band-passed noise + a wobbling tone, in bursts separated by pauses
  const bursts: [number, number][] = [[0.4, 3.4], [3.9, 6.2], [7.6, 10.1], [10.5, 12.3], [13.4, 14.7]];
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * SEC, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = noiseBuf;
  const band = ac.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 900; band.Q.value = 0.8;
  const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 170;
  const lfo = ac.createOscillator(); lfo.frequency.value = 5.5;
  const lfoGain = ac.createGain(); lfoGain.gain.value = 40;
  lfo.connect(lfoGain).connect(osc.frequency);
  const oscGain = ac.createGain(); oscGain.gain.value = 0.05;
  const env = ac.createGain(); env.gain.value = 0;
  noise.connect(band).connect(env);
  osc.connect(oscGain).connect(env);
  env.connect(dest);
  const t0 = ac.currentTime + 0.05;
  for (const [a, b] of bursts) {
    // syllable-like modulation inside each burst
    for (let t = a; t < b; t += 0.19) {
      env.gain.setTargetAtTime(0.5 + Math.random() * 0.4, t0 + t, 0.015);
      env.gain.setTargetAtTime(0.12, t0 + t + 0.11, 0.02);
    }
    env.gain.setTargetAtTime(0.0001, t0 + b, 0.02);
  }
  noise.start(t0); osc.start(t0); lfo.start(t0);

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(250);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      const speaking = bursts.some(([a, b]) => t >= a && t <= b);
      // warm, slightly yellow scene (so the white-balance suggestion has something to say)
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#3b2f22'); g.addColorStop(1, '#171410');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,214,120,.10)'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.18, 260, 0, Math.PI * 2); ctx.fill();
      // presenter silhouette
      const bob = Math.sin(t * 2) * 4;
      ctx.fillStyle = '#e8c9a3'; ctx.beginPath(); ctx.arc(W / 2, H * 0.4 + bob, 118, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2f3a'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.78 + bob, 260, 230, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5a3d2b'; ctx.beginPath(); ctx.arc(W / 2, H * 0.37 + bob, 124, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      // mouth
      ctx.fillStyle = '#7a3b35';
      ctx.beginPath(); ctx.ellipse(W / 2, H * 0.45 + bob, 30, speaking ? 8 + Math.abs(Math.sin(t * 17)) * 14 : 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 26px Inter, Arial'; ctx.textAlign = 'center';
      ctx.fillText('vídeo de exemplo · modo demo', W / 2, H - 70);
      onProgress?.(Math.min(1, t / SEC));
      if (t < SEC) requestAnimationFrame(draw); else resolve();
    };
    draw();
    // rAF pauses in background tabs; keep drawing with a timer too
    const iv = setInterval(() => { if ((performance.now() - start) / 1000 >= SEC) { clearInterval(iv); resolve(); } }, 200);
  });
  rec.stop();
  await done;
  void ac.close();
  if (!chunks.length) throw new Error('O navegador não gravou o vídeo de exemplo. Tente no Chrome ou Edge atualizados.');
  return new File([new Blob(chunks, { type: 'video/webm' })], 'video-de-exemplo.webm', { type: 'video/webm' });
}
