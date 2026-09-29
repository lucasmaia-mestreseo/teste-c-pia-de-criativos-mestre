/**
 * MODO DEMO — in-browser state (tables + storage), persisted to localStorage
 * so reloads keep what you did. Add `?reset-demo` to the URL to start over.
 */
import { createSeed, type Row, type Tables } from './seed';

const STORAGE_KEY = 'criativos-mestre-demo-v1';

interface DemoState { tables: Tables; storage: Record<string, string>; storageMeta?: Record<string, string> }

function loadState(): DemoState {
  try {
    if (new URLSearchParams(location.search).has('reset-demo')) {
      localStorage.removeItem(STORAGE_KEY);
      history.replaceState(null, '', location.pathname + location.hash);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createSeed();
}

export const state: DemoState = loadState();

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota: keep in memory only */ }
  }, 200);
}
persist();

export const table = (name: string): Row[] => (state.tables[name] ??= []);
export const newId = () => crypto.randomUUID();
