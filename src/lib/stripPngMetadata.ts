const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const KEEP_TYPES = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

export function stripPngMetadata(data: Uint8Array): Uint8Array {
  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) return data; // Not a PNG, return as-is
  }

  const chunks: Uint8Array[] = [PNG_SIGNATURE];
  let offset = 8;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset < data.length) {
    if (offset + 8 > data.length) break;
    const length = view.getUint32(offset);
    const typeBytes = data.slice(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const totalChunkSize = 12 + length; // 4 len + 4 type + data + 4 crc

    if (offset + totalChunkSize > data.length) break;

    if (KEEP_TYPES.has(type)) {
      chunks.push(data.slice(offset, offset + totalChunkSize));
    }

    offset += totalChunkSize;
    if (type === "IEND") break;
  }

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    result.set(c, pos);
    pos += c.length;
  }
  return result;
}
