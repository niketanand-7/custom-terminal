import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketStore } from '../../stores/marketStore'
import type { Tick } from '../../types'

describe('marketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({ tickers: {}, connectionStatus: 'disconnected' }, true)
  })

  it('has initial state with empty tickers and disconnected', () => {
    const { tickers, connectionStatus } = useMarketStore.getState()
    expect(tickers).toEqual({})
    expect(connectionStatus).toBe('disconnected')
  })

  it('updateTick adds a new ticker', () => {
    const tick: Tick = {
      symbol: 'BTC/USDT',
      price: 50000,
      change24h: 2.5,
      high24h: 51000,
      low24h: 49000,
      volume24h: 1000000,
      timestamp: Date.now(),
    }
    useMarketStore.getState().updateTick(tick)
    const { tickers } = useMarketStore.getState()
    expect(tickers['BTC/USDT']).toEqual(tick)
  })

  it('updateTick updates existing ticker', () => {
    const tick1: Tick = {
      symbol: 'BTC/USDT',
      price: 50000,
      change24h: 2.5,
      high24h: 51000,
      low24h: 49000,
      volume24h: 1000000,
      timestamp: 1000,
    }
    const tick2: Tick = { ...tick1, price: 51000, timestamp: 2000 }
    useMarketStore.getState().updateTick(tick1)
    useMarketStore.getState().updateTick(tick2)
    const { tickers } = useMarketStore.getState()
    expect(tickers['BTC/USDT'].price).toBe(51000)
  })

  it('setConnectionStatus updates status', () => {
    useMarketStore.getState().setConnectionStatus('connected')
    expect(useMarketStore.getState().connectionStatus).toBe('connected')
  })

  it('setConnectionStatus to reconnecting', () => {
    useMarketStore.getState().setConnectionStatus('reconnecting')
    expect(useMarketStore.getState().connectionStatus).toBe('reconnecting')
  })

  it('updating one symbol does not clobber another', () => {
    const btc: Tick = {
      symbol: 'BTC/USDT', price: 50000, change24h: 2.5,
      high24h: 51000, low24h: 49000, volume24h: 1000000, timestamp: 1000,
    }
    const eth: Tick = {
      symbol: 'ETH/USDT', price: 2000, change24h: 1.0,
      high24h: 2100, low24h: 1900, volume24h: 500000, timestamp: 1000,
    }
    useMarketStore.getState().updateTick(btc)
    useMarketStore.getState().updateTick(eth)
    const { tickers } = useMarketStore.getState()
    expect(tickers['BTC/USDT'].price).toBe(50000)
    expect(tickers['ETH/USDT'].price).toBe(2000)
  })
})
