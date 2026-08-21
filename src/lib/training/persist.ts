"use client";

/**
 * Session-scoped persistence for the simulators.
 *
 * A trainee halfway through a guided task should not lose the matter they just
 * created because they refreshed the page or followed a link and came back.
 * Each simulator keeps its state in a plain reducer, so this wraps the reducer
 * rather than changing any of them: state is written to sessionStorage on
 * every change and read back once on mount.
 *
 * sessionStorage, not localStorage: the simulators are a sandbox, so the work
 * should survive a refresh and a navigation but not outlive the browser tab.
 * Nothing here is real client data, but a training sandbox that quietly
 * remembers last month's practice run is confusing rather than helpful.
 */

import { useCallback, useEffect, useReducer, useRef, type Dispatch } from "react";

const HYDRATE = "__hydrate__";

type HydrateAction<S> = { type: typeof HYDRATE; state: S };

/**
 * A reducer-backed store that restores itself from sessionStorage.
 *
 * The first render always uses `init()` so the server and the client agree;
 * the stored state is applied immediately afterwards in an effect.
 */
export function usePersistentReducer<S, A extends { type: string }>(
  storageKey: string,
  reducer: (state: S, action: A) => S,
  init: () => S,
): [S, Dispatch<A>] {
  const wrapped = useCallback(
    (state: S, action: A | HydrateAction<S>): S =>
      action.type === HYDRATE
        ? (action as HydrateAction<S>).state
        : reducer(state, action as A),
    [reducer],
  );

  const [state, dispatch] = useReducer(wrapped, undefined as never, init);

  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) dispatch({ type: HYDRATE, state: JSON.parse(stored) as S });
    } catch {
      // Corrupt or unavailable storage: carry on with the seed rather than
      // failing the whole simulator.
    }
  }, [storageKey]);

  useEffect(() => {
    // Skip the very first write so a fresh tab does not immediately overwrite
    // whatever a previous render of this key stored.
    if (!hydrated.current) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked — the simulator still works, it just
      // will not survive a refresh.
    }
  }, [storageKey, state]);

  return [state, dispatch as Dispatch<A>];
}

/** Drops a simulator's stored state, for the Reset control. */
export function clearPersistedState(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing to do — the in-memory reset still happens.
  }
}
