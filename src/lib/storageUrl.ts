import { supabase } from '@/integrations/supabase/client';

const KNOWN_BUCKETS = ['logos', 'swipe-files', 'generated-creatives', 'brand-photos', 'people-photos'];
const SIGN_EXPIRES = 60 * 60 * 24 * 7; // 7 days

const cache = new Map<string, { url: string; exp: number }>();

function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  if (!url || typeof url !== 'string') return null;
  // Match /storage/v1/object/(public|sign)/{bucket}/{path}
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  const bucket = m[1];
  if (!KNOWN_BUCKETS.includes(bucket)) return null;
  return { bucket, path: decodeURIComponent(m[2]) };
}

/** Turn a stored (possibly public-format) storage URL into a short-lived signed URL. */
export async function toSignedUrl(url: string | null | undefined): Promise<string> {
  if (!url) return url ?? '';
  const parsed = parsePublicUrl(url);
  if (!parsed) return url;
  const key = `${parsed.bucket}/${parsed.path}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGN_EXPIRES);
  if (error || !data?.signedUrl) return url;
  cache.set(key, { url: data.signedUrl, exp: now + SIGN_EXPIRES * 1000 });
  return data.signedUrl;
}

export async function toSignedUrls(urls: (string | null | undefined)[] | null | undefined): Promise<string[]> {
  if (!urls) return [];
  return Promise.all(urls.map((u) => toSignedUrl(u ?? '')));
}

/** Batch-sign specific keys on an object; returns a new object with signed URLs. */
export async function signFields<T extends Record<string, any>>(obj: T, urlKeys: (keyof T)[], arrayKeys: (keyof T)[] = []): Promise<T> {
  const out: any = { ...obj };
  await Promise.all([
    ...urlKeys.map(async (k) => { out[k] = await toSignedUrl(obj[k]); }),
    ...arrayKeys.map(async (k) => { out[k] = Array.isArray(obj[k]) ? await toSignedUrls(obj[k]) : obj[k]; }),
  ]);
  return out as T;
}
