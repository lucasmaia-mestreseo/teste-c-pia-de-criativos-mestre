// Shared storage/image helpers for Edge Functions.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Strip non-essential PNG chunks (metadata, EXIF, text) keeping only image data. */
export function stripPngMetadata(data: Uint8Array): Uint8Array {
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIG[i]) return data; // Not a PNG, return as-is
  }
  const keepTypes = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  const chunks: Uint8Array[] = [data.slice(0, 8)];
  let offset = 8;
  while (offset < data.length) {
    const len = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const chunkSize = 12 + len; // 4 len + 4 type + data + 4 crc
    if (keepTypes.has(type)) chunks.push(data.slice(offset, offset + chunkSize));
    offset += chunkSize;
    if (type === "IEND") break;
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
  return result;
}

/**
 * Turn the image returned by the model (data URL, raw base64 or remote URL)
 * into bytes, stripping PNG metadata.
 */
export async function imageToBytes(image: string): Promise<Uint8Array> {
  if (image.startsWith("http")) {
    const res = await fetch(image);
    if (!res.ok) throw new Error(`Falha ao baixar imagem gerada: ${res.status}`);
    return stripPngMetadata(new Uint8Array(await res.arrayBuffer()));
  }
  const base64 = image.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  return stripPngMetadata(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** Upload a generated PNG under `{projectId}/{prefix}{uuid}.png` and return its (public-format) URL. */
export async function uploadGeneratedImage(
  client: SupabaseClient,
  bucket: string,
  projectId: string,
  bytes: Uint8Array,
  prefix = "",
): Promise<string> {
  const filePath = `${projectId}/${prefix}${crypto.randomUUID()}.png`;
  const { error } = await client.storage.from(bucket).upload(filePath, bytes, { contentType: "image/png" });
  if (error) throw error;
  return client.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
}

/** Parse `/storage/v1/object/(public|sign)/{bucket}/{path}` URLs. */
export function parseStorageUrl(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Like signStorageUrl, but for URLs that come from the client: only files inside
 * `{projectId}/` are signed (with the service role), so a caller cannot get a
 * signed link to another project's files. Anything else is returned unchanged —
 * a URL the client already signed itself keeps working as before.
 */
export async function signProjectStorageUrl(
  client: SupabaseClient,
  url: string | null | undefined,
  projectId: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed || !parsed.path.startsWith(`${projectId}/`)) return url;
  return signStorageUrl(client, url, expiresIn);
}

/**
 * Buckets are private, so external AI providers need a signed URL.
 * Non-storage URLs (e.g. data URLs) are returned unchanged.
 */
export async function signStorageUrl(client: SupabaseClient, url: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  const { data } = await client.storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresIn);
  return data?.signedUrl ?? url;
}
