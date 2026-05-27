import { useCallback, useRef, useState } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initial: T, maxSize = 50) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = useCallback((next: T) => {
    setState(s => {
      const past = [...s.past, s.present];
      if (past.length > maxSize) past.shift();
      return { past, present: next, future: [] };
    });
  }, [maxSize]);

  const undo = useCallback(() => {
    setState(s => {
      if (s.past.length === 0) return s;
      const past = [...s.past];
      const prev = past.pop()!;
      return { past, present: prev, future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setState(s => {
      if (s.future.length === 0) return s;
      const future = [...s.future];
      const next = future.shift()!;
      return { past: [...s.past, s.present], present: next, future };
    });
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return { value: state.present, set, undo, redo, canUndo, canRedo };
}
