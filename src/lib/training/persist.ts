"use client";

/**
 * Storage-backed persistence for reducer-driven tools.
 *
 * A trainee halfway through a guided task should not lose the matter they just
 * created because they refreshed the page or followed a link and came back.
 * Each tool keeps its state in a plain reducer, so this wraps the reducer
 * rather than changing any of them: state is written to storage on every
 * change and read back once on mount.
 *
 * Defaults to sessionStorage: the training simulators are a sandbox, so the
 * work should survive a refresh and a navigation but not outlive the browser
 * tab — a training sandbox that quietly remembers last month's practice run
 * is confusing rather than helpful. Tools where the state is a real working
 * document a colleague returns to over hours or days (e.g. the settlement
 * calculator) should pass `{ storage: "local" }` instead, so it survives
 * closing the tab too.
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
  options?: { storage?: "session" | "local" },
): [S, Dispatch<A>] {
  const storageArea = options?.storage === "local" ? "localStorage" : "sessionStorage";

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
      const stored = window[storageArea].getItem(storageKey);
      if (stored) dispatch({ type: HYDRATE, state: JSON.parse(stored) as S });
    } catch {
      // Corrupt or unavailable storage: carry on with the seed rather than
      // failing the whole tool.
    }
  }, [storageKey, storageArea]);

  useEffect(() => {
    // Skip the very first write so a fresh tab does not immediately overwrite
    // whatever a previous render of this key stored.
    if (!hydrated.current) return;
    try {
      window[storageArea].setItem(storageKey, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked — the tool still works, it just
      // will not survive a refresh.
    }
  }, [storageKey, storageArea, state]);

  return [state, dispatch as Dispatch<A>];
}

/** Drops a tool's stored state, for a Reset/New control. */
export function clearPersistedState(storageKey: string, options?: { storage?: "session" | "local" }) {
  const storageArea = options?.storage === "local" ? "localStorage" : "sessionStorage";
  try {
    window[storageArea].removeItem(storageKey);
  } catch {
    // Nothing to do — the in-memory reset still happens.
  }
}
