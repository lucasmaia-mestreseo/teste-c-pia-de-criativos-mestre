import { useCallback, useRef, useState } from 'react';

type Updater = number | null | ((prev: number | null) => number | null);

/**
 * Index-style selection (for modals with prev/next) that is anchored to the
 * item's id. With a plain index, new items arriving at the top of the list
 * (a resize, a variant…) silently swap the creative shown in the open modal.
 *
 * `matches` lets an item stand for others (the options of a piece): the selected
 * id may be any of them, and it's returned so the modal can show that one.
 */
export function useSelectedById<T extends { id: string }>(
  items: T[],
  matches?: (item: T, id: string) => boolean,
): [number | null, (u: Updater) => void, string | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const matchRef = useRef(matches);
  matchRef.current = matches;
  const find = (list: T[], id: string) => list.findIndex((i) => i.id === id || !!matchRef.current?.(i, id));
  const idx = selectedId ? find(items, selectedId) : -1;
  const selectedIndex = idx >= 0 ? idx : null;

  const setSelectedIndex = useCallback((u: Updater) => {
    setSelectedId((prevId) => {
      const prevIdx = prevId ? find(items, prevId) : -1;
      const next = typeof u === 'function' ? u(prevIdx >= 0 ? prevIdx : null) : u;
      return next === null || next < 0 || next >= items.length ? null : items[next].id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return [selectedIndex, setSelectedIndex, selectedIndex === null ? null : selectedId, setSelectedId];
}
