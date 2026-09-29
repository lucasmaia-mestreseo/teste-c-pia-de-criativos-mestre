import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EDIT_SETTINGS, applyOperations, buildBlocks, buildSrt, detectCuts, keepRanges, mapTime, markWords, summarize, type Word,
} from '@/video/engine';
import { demoAstra, demoTranscribe } from '@/demo/videoDemo';

const w = (word: string, start: number, end: number): Word => ({ word, start, end });
const WORDS: Word[] = [
  w('Oi,', 0.2, 0.4), w('eh,', 0.5, 0.7), w('eu', 0.8, 0.9), w('sou', 1.0, 1.2),
  w('a', 1.3, 1.35), w('gente', 1.4, 1.7), w('a', 1.75, 1.8), w('gente', 1.85, 2.1),
  w('pro', 2.2, 2.35), w('produtividade.', 2.4, 3.1), w('Salva', 5.2, 5.5), w('esse', 5.6, 5.8), w('vídeo.', 5.9, 6.3),
];
const cfg = DEFAULT_EDIT_SETTINGS.cutDetection;

describe('video engine (port of the local editor)', () => {
  it('detects silences, fillers, repeated blocks (keeping the last take) and stutters', () => {
    const cuts = detectCuts({ words: WORDS, silences: [{ start: 3.2, end: 5.1 }], duration: 7, config: cfg });
    const reasons = cuts.map((c) => c.reason);
    expect(reasons).toContain('silencio');
    expect(reasons).toContain('vicio');
    expect(reasons).toContain('repeticao');
    expect(reasons).toContain('gagueira');
    const marked = markWords(WORDS, cuts);
    expect(marked.filter((x) => x.cut).map((x) => x.word)).toEqual(['eh,', 'a', 'gente', 'pro']);
    // the silence keeps a breath at both ends
    const sil = cuts.find((c) => c.reason === 'silencio')!;
    expect(sil.start).toBeCloseTo(3.2 + cfg.paddingSec);
    expect(sil.end).toBeCloseTo(5.1 - cfg.paddingSec);
  });

  it('respects the switches', () => {
    const cuts = detectCuts({ words: WORDS, silences: [], duration: 7, config: { ...cfg, removeFillers: false, removeRepeats: false, removeStutters: false } });
    expect(cuts).toHaveLength(0);
  });

  it('maps time into the cut video and summarizes', () => {
    const cuts = [{ id: 'a', start: 1, end: 2, reason: 'manual' as const, label: '', enabled: true }, { id: 'b', start: 3, end: 4, reason: 'manual' as const, label: '', enabled: false }];
    const keeps = keepRanges(6, cuts);
    expect(keeps).toEqual([{ start: 0, end: 1 }, { start: 2, end: 6 }]);
    expect(mapTime(2.5, keeps)).toBeCloseTo(1.5);
    expect(summarize(6, cuts)).toMatchObject({ finalDuration: 5, cutCount: 1 });
  });

  it('builds caption blocks in the cut timeline and a valid SRT', () => {
    const cuts = detectCuts({ words: WORDS, silences: [{ start: 3.2, end: 5.1 }], duration: 7, config: cfg });
    const blocks = buildBlocks(markWords(WORDS, cuts), keepRanges(7, cuts), { ...DEFAULT_EDIT_SETTINGS.captions, maxWordsPerLine: 2, maxLines: 2 });
    expect(blocks[0].lines[0]).toBe('Oi, eu');
    expect(blocks.every((b, i) => i === 0 || b.start >= blocks[i - 1].end)).toBe(true);
    const srt = buildSrt(blocks);
    expect(srt).toMatch(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\nOi, eu/);
  });

  it('applies Astra plans within limits and ignores unknown paths', () => {
    const r = applyOperations(DEFAULT_EDIT_SETTINGS, [], [
      { tipo: 'ajustar', caminho: 'captions.fontSizePx', valor: 999 },
      { tipo: 'ajustar', caminho: 'captions.color', valor: 'amarelo' },
      { tipo: 'ajustar', caminho: 'hack.x', valor: 1 },
      { tipo: 'corte_adicionar', inicio: 12, fim: 14 },
    ], 60);
    expect(r.settings.captions.fontSizePx).toBe(200);
    expect(r.settings.captions.color).toBe('#FFD400');
    expect(r.cuts).toHaveLength(1);
    expect(r.log).toHaveLength(2);
  });
});

describe('video demo', () => {
  it('lays the script over the speech regions only', () => {
    const { words } = demoTranscribe(10, [{ start: 0.5, end: 3 }, { start: 5, end: 8 }]);
    expect(words.length).toBeGreaterThan(8);
    expect(words.every((x) => (x.start >= 0.5 && x.end <= 3) || (x.start >= 5 && x.end <= 8))).toBe(true);
  });

  it('understands common requests', () => {
    const s = { settings: { captions: { fontSizePx: 72 }, image: { whiteBalance: 0, sharpen: 35 } } as never, duration: 30 };
    const a = demoAstra('Legenda menor, traçado de 5 px e a imagem está amarelada', s);
    expect(a.operacoes).toEqual(expect.arrayContaining([
      { tipo: 'ajustar', caminho: 'captions.fontSizePx', valor: 60 },
      { tipo: 'ajustar', caminho: 'captions.outlinePx', valor: 5 },
      { tipo: 'ajustar', caminho: 'image.whiteBalance', valor: -20 },
    ]));
    expect(a.operacoes.some((o) => o.caminho === 'captions.color')).toBe(false);
    expect(demoAstra('corta de 12 a 14 segundos', s).operacoes).toEqual([{ tipo: 'corte_adicionar', inicio: 12, fim: 14, rotulo: 'Pedido: 12s a 14s' }]);
    expect(demoAstra('tira os vícios de linguagem', s).operacoes).toEqual([{ tipo: 'cortes_por_motivo', motivo: 'vicio', ativo: true }]);
    expect(demoAstra('legenda branca', s).operacoes).toEqual([{ tipo: 'ajustar', caminho: 'captions.color', valor: '#FFFFFF' }]);
    expect(demoAstra('faz um café', s).operacoes).toEqual([]);
  });
});
