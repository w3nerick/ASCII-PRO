import { useEffect } from 'react';

export interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Bind keyboard shortcuts. Ignores key events that originate from text inputs
 * so typing in the custom-charset / color fields stays unaffected.
 */
export function useKeyboardShortcuts(map: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) return;
      }
      const key = e.key.toLowerCase();
      const fn = map[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled]);
}
