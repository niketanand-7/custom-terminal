import type { StoreApi } from 'zustand'

/**
 * Patch a Zustand store's setState so that replace=true calls
 * preserve action functions (zustand v5 compatibility).
 */
export function patchStoreSetState<S extends object>(
  store: StoreApi<S>,
  actionKeys: (keyof S)[],
): void {
  const originalSetState = store.setState.bind(store)
  const actions = {} as Partial<S>
  const state = store.getState()
  for (const key of actionKeys) {
    actions[key] = state[key]
  }

  store.setState = (partial: unknown, replace?: boolean) => {
    if (replace) {
      const next = typeof partial === 'function' ? (partial as (s: S) => S)(store.getState()) : partial as S
      originalSetState({ ...actions, ...next } as S, true)
    } else {
      originalSetState(partial as Partial<S>, false)
    }
  }
}
