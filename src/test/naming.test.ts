import { describe, it, expect } from 'vitest';
import { bannerLabel, creativeFileName, pixelsLabel } from '@/lib/creativeNames';
import { blobBytes, makeZip } from '@/lib/zip';

describe('agency naming', () => {
  it('follows [Cliente] [WxH] [Bxx] Tarefa', () => {
    expect(creativeFileName({ client: 'Spasso Splash', format: '4:5', bannerNumber: 1, task: 'Solicitação de Banners - Atualização de Campanhas' }))
      .toBe('[Spasso Splash] [1080x1350] [B01] Solicitação de Banners - Atualização de Campanhas.png');
  });

  it('maps every platform format to its delivery size', () => {
    expect(['9:16', '4:5', '1:1', '16:9', '3:4', '1.91:1'].map(pixelsLabel))
      .toEqual(['1080x1920', '1080x1350', '1080x1080', '1920x1080', '1080x1440', '1200x628']);
  });

  it('removes characters Windows does not accept (the | in task names)', () => {
    expect(creativeFileName({ client: 'Spasso', format: '9:16', bannerNumber: 12, task: 'Banners | Outubro' }))
      .toBe('[Spasso] [1080x1920] [B12] Banners - Outubro.png');
  });

  it('keeps names unique for loose pieces', () => {
    expect(creativeFileName({ client: 'Spasso', format: '1:1', id: 'abcdef123' })).toBe('[Spasso] [1080x1080] abcdef.png');
    expect(bannerLabel(null)).toBeNull();
  });
});

describe('zip', () => {
  it('writes a valid stored zip with UTF-8 names', async () => {
    const zip = await makeZip([{ name: '[Spasso] [B01] Promoção.png', data: new Blob([new Uint8Array([1, 2, 3])]) }]);
    const bytes = await blobBytes(zip);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // local header
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800); // UTF-8 flag
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50); // end of central directory
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(1); // one file
  });
});
