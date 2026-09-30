/**
 * How projects are organized for each person:
 *  - Recentes: the ones this person opened lately (kept in the browser, per user);
 *  - Meus projetos: the ones this person created (`projects.created_by`, plus the
 *    ones created in this browser, so it works even before the migration);
 *  - Todos os projetos: everything the person can access.
 */

const read = (k: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const recentKey = (uid: string) => `cm-recent-projects:${uid}`;
const createdKey = (uid: string) => `cm-created-projects:${uid}`;

export function touchRecentProject(uid: string | undefined, projectId: string) {
  if (!uid || !projectId) return;
  write(recentKey(uid), [projectId, ...read(recentKey(uid)).filter((x) => x !== projectId)].slice(0, 20));
}

export const recentProjectIds = (uid: string | undefined) => (uid ? read(recentKey(uid)) : []);

export function rememberCreatedProject(uid: string | undefined, projectId: string) {
  if (!uid) return;
  write(createdKey(uid), [projectId, ...read(createdKey(uid)).filter((x) => x !== projectId)].slice(0, 200));
}

export interface ProjectLike { id: string; name: string; created_at?: string | null; updated_at?: string | null; created_by?: string | null; active?: boolean | null }

export function isMine(p: ProjectLike, uid: string | undefined): boolean {
  if (!uid) return false;
  return p.created_by === uid || read(createdKey(uid)).includes(p.id);
}

/** Recent first (opened lately), then the most recently updated ones. */
export function recentProjects<T extends ProjectLike>(all: T[], uid: string | undefined, limit = 8): T[] {
  const order = recentProjectIds(uid);
  const byId = new Map(all.map((p) => [p.id, p]));
  const opened = order.map((id) => byId.get(id)).filter(Boolean) as T[];
  const rest = all.filter((p) => !order.includes(p.id))
    .sort((a, b) => (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? ''));
  return [...opened, ...rest].slice(0, limit);
}

/** "[Spasso Splash] Solicitação…" → "SS" (brackets and symbols don't count). */
export function projectInitials(name: string) {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [name];
  return words.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Stable, brand-friendly color per project (for the initials avatar). */
export function projectColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${(58 + (h % 7) * 12) % 360} 90% 62%)`;
}
