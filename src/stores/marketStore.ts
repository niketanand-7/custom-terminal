import { create } from 'zustand'
import type { Tick } from '../types'

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

type MarketState = {
  tickers: Record<string, Tick>
  connectionStatus: ConnectionStatus
  updateTick: (tick: Tick) => void
  setConnectionStatus: (status: ConnectionStatus) => void
}

const useMarketStoreBase = create<MarketState>()((set) => ({
  tickers: {},
  connectionStatus: 'disconnected',

  updateTick: (tick: Tick) =>
    set((state) => ({
      tickers: { ...state.tickers, [tick.symbol]: tick },
    })),

  setConnectionStatus: (status: ConnectionStatus) =>
    set({ connectionStatus: status }),
}))

// Preserve action functions when setState is called with replace=true (zustand v5 compatibility)
const originalSetState = useMarketStoreBase.setState.bind(useMarketStoreBase)
const actions = (() => {
  const s = useMarketStoreBase.getState()
  return {
    updateTick: s.updateTick,
    setConnectionStatus: s.setConnectionStatus,
  }
})()

useMarketStoreBase.setState = (partial, replace) => {
  if (replace) {
    const next = typeof partial === 'function' ? partial(useMarketStoreBase.getState()) : partial
    originalSetState({ ...actions, ...next } as MarketState, true)
  } else {
    originalSetState(partial as Partial<MarketState>, false)
  }
}

export const useMarketStore = useMarketStoreBase
