/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MODO DEMO — drop-in replacement for "@/integrations/supabase/client".
 *
 * Only used with `npm run dev:demo` (vite --mode demo, see vite.config.ts).
 * Everything lives in the browser: an in-memory database seeded with fictitious
 * data (saved to localStorage), an always-logged-in owner user, a fake storage
 * and simulated Edge Functions that return placeholder images instead of
 * calling any AI. Nothing here is bundled in the production build.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { DEMO_USER, storagePublicUrl, type Row } from './seed';
import { newId, persist, state, table } from './store';
import { runDemoFunction } from './functions';

const DEFAULTS: Record<string, () => Row> = {
  generated_creatives: () => ({ favorite: false, kind: 'generate', review: null, review_status: null, created_at: new Date().toISOString() }),
  projects: () => ({ active: true, onboarding_completed: false, context: null, voice_guide: null, description: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  swipe_files: () => ({ analysis: null, width: null, height: null, created_at: new Date().toISOString() }),
  ai_usage: () => ({ success: true, created_at: new Date().toISOString() }),
};

// ─── Query builder (the subset of PostgREST the app uses) ───

type Filter = (r: Row) => boolean;

class DemoQuery implements PromiseLike<any> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row[] = [];
  private values: Row = {};
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private from?: number;
  private to?: number;
  private limitN?: number;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private returning = false;
  private countMode = false;
  private head = false;
  private conflict?: string;

  constructor(private readonly name: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.countMode = !!opts?.count;
      this.head = !!opts?.head;
    } else {
      this.returning = true;
    }
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.conflict = opts?.onConflict ?? 'id'; return this; }
  update(values: Row) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this; }
  ilike(c: string, pattern: string) {
    const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
    this.filters.push((r) => re.test(String(r[c] ?? '')));
    return this;
  }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  range(from: number, to: number) { this.from = from; this.to = to; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private matches(r: Row) { return this.filters.every((f) => f(r)); }

  private execute(): { data: any; error: any; count?: number | null } {
    const rows = table(this.name);
    let result: Row[] = [];

    if (this.op === 'select') {
      result = rows.filter((r) => this.matches(r));
      for (const { col, asc } of [...this.orders].reverse()) {
        result = [...result].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      const count = result.length;
      if (this.from !== undefined) result = result.slice(this.from, (this.to ?? this.from) + 1);
      if (this.limitN !== undefined) result = result.slice(0, this.limitN);
      if (this.head) return { data: null, error: null, count };
      return this.shape(result.map((r) => ({ ...r })), this.countMode ? count : null);
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const keys = (this.conflict ?? 'id').split(',').map((k) => k.trim());
      for (const p of this.payload) {
        const existing = this.op === 'upsert' ? rows.find((r) => keys.every((k) => p[k] !== undefined && r[k] === p[k])) : undefined;
        if (existing) {
          Object.assign(existing, p);
          result.push({ ...existing });
        } else {
          const row = { id: newId(), ...(DEFAULTS[this.name]?.() ?? {}), ...p };
          rows.push(row);
          result.push({ ...row });
        }
      }
    } else if (this.op === 'update') {
      for (const r of rows) if (this.matches(r)) { Object.assign(r, this.values); result.push({ ...r }); }
    } else if (this.op === 'delete') {
      const keep = rows.filter((r) => !this.matches(r));
      result = rows.filter((r) => this.matches(r));
      state.tables[this.name] = keep;
    }
    persist();
    return this.returning ? this.shape(result, null) : { data: null, error: null };
  }

  private shape(result: Row[], count: number | null) {
    if (this.mode === 'many') return { data: result, error: null, count };
    if (result.length === 1) return { data: result[0], error: null };
    if (result.length === 0 && this.mode === 'maybe') return { data: null, error: null };
    return { data: null, error: { code: 'PGRST116', message: `Esperava 1 linha, encontrou ${result.length}` } };
  }

  then<T1 = any, T2 = never>(onfulfilled?: ((v: any) => T1 | PromiseLike<T1>) | null, onrejected?: ((e: any) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }
}

// ─── Auth: always logged in as the demo owner ───

type AuthListener = (event: string, session: any) => void;
const listeners = new Set<AuthListener>();
let signedIn = true;
const session = () => (signedIn ? { access_token: 'demo', token_type: 'bearer', user: DEMO_USER } : null);

const auth = {
  getSession: async () => ({ data: { session: session() }, error: null }),
  getUser: async () => ({ data: { user: signedIn ? DEMO_USER : null }, error: null }),
  onAuthStateChange: (cb: AuthListener) => {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  signInWithPassword: async () => {
    signedIn = true;
    listeners.forEach((l) => l('SIGNED_IN', session()));
    return { data: { session: session(), user: DEMO_USER }, error: null };
  },
  signOut: async () => {
    signedIn = false;
    listeners.forEach((l) => l('SIGNED_OUT', null));
    return { error: null };
  },
  signUp: async () => ({ data: { user: DEMO_USER, session: session() }, error: null }),
  resend: async () => ({ data: {}, error: null }),
  updateUser: async () => ({ data: { user: DEMO_USER }, error: null }),
};

// ─── Storage ───

const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, file: Blob) => {
      state.storage[`${bucket}/${path}`] = await fileToDataUrl(file);
      (state.storageMeta ??= {})[`${bucket}/${path}`] = new Date().toISOString();
      persist();
      return { data: { path }, error: null };
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: storagePublicUrl(bucket, path) } }),
    createSignedUrl: async (path: string) => {
      const url = state.storage[`${bucket}/${path}`];
      return url ? { data: { signedUrl: url }, error: null } : { data: null, error: { message: 'Arquivo não encontrado (demo)' } };
    },
    remove: async (paths: string[]) => {
      for (const p of paths) delete state.storage[`${bucket}/${p}`];
      persist();
      return { data: [], error: null };
    },
    list: async (prefix = '') => {
      const base = `${bucket}/${prefix ? `${prefix.replace(/\/$/, '')}/` : ''}`;
      const data = Object.keys(state.storage)
        .filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'))
        .map((k) => ({ name: k.slice(base.length), created_at: state.storageMeta?.[k] ?? new Date().toISOString() }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { data, error: null };
    },
    download: async (path: string) => {
      const url = state.storage[`${bucket}/${path}`];
      if (!url) return { data: null, error: { message: 'Arquivo não encontrado (demo)' } };
      return { data: await (await fetch(url)).blob(), error: null };
    },
  }),
};

// ─── Edge Functions (simulated) ───

const functions = {
  invoke: async (name: string, opts?: { body?: any }) => {
    try {
      const data = await runDemoFunction(name, opts?.body ?? {});
      return { data, error: null };
    } catch (e) {
      return { data: { error: e instanceof Error ? e.message : String(e) }, error: null };
    }
  },
};

const demoClient = {
  from: (name: string) => new DemoQuery(name),
  rpc: async () => ({ data: true, error: null }),
  auth,
  storage,
  functions,
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
};

export const supabase = demoClient as unknown as SupabaseClient<Database>;

// ─── Visible "MODO DEMO" badge so nobody confuses it with the real app ───

if (typeof document !== 'undefined') {
  const mount = () => {
    if (document.getElementById('demo-badge')) return;
    const el = document.createElement('div');
    el.id = 'demo-badge';
    el.innerHTML = '<strong>DEMO</strong> · <a href="?reset-demo" style="text-decoration:underline">recomeçar</a>';
    el.title = 'Modo demo: dados fictícios, sem IA real';
    el.setAttribute('style', 'position:fixed;right:12px;top:54px;z-index:9999;opacity:.9;background:hsl(58 100% 67.5%);color:#111;font:12px Inter,Arial,sans-serif;padding:3px 10px;border-radius:999px;font-size:11px;box-shadow:0 4px 14px rgba(0,0,0,.35)');
    document.body.appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
