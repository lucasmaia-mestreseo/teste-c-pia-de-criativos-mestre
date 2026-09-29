import { useCallback, useState } from 'react';

type Updater = number | null | ((prev: number | null) => number | null);

/**
 * Index-style selection (for modals with prev/next) that is anchored to the
 * item's id. With a plain index, new items arriving at the top of the list
 * (a resize, a variant…) silently swap the creative shown in the open modal.
 */
export function useSelectedById<T extends { id: string }>(items: T[]): [number | null, (u: Updater) => void] {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const idx = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
  const selectedIndex = idx >= 0 ? idx : null;

  const setSelectedIndex = useCallback((u: Updater) => {
    setSelectedId((prevId) => {
      const prevIdx = prevId ? items.findIndex((i) => i.id === prevId) : -1;
      const next = typeof u === 'function' ? u(prevIdx >= 0 ? prevIdx : null) : u;
      return next === null || next < 0 || next >= items.length ? null : items[next].id;
    });
  }, [items]);

  return [selectedIndex, setSelectedIndex];
}
