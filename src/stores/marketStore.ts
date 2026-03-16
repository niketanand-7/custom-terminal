import { create } from 'zustand'
import type { Tick, ConnectionStatus } from '../types'
import { patchStoreSetState } from './patchStoreSetState'

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
    set((state) => {
      const existing = state.tickers[tick.symbol]
      if (existing && existing.price === tick.price && existing.timestamp === tick.timestamp) {
        return state
      }
      return { tickers: { ...state.tickers, [tick.symbol]: tick } }
    }),

  setConnectionStatus: (status: ConnectionStatus) =>
    set({ connectionStatus: status }),
}))

patchStoreSetState(useMarketStoreBase, ['updateTick', 'setConnectionStatus'])

export const useMarketStore = useMarketStoreBase
