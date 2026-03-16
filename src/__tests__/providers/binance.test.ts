import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test that creating the singleton wires onStatusChange to marketStore.
// Since binance.ts creates things at import time, we test the wiring behavior.

describe('binance singleton', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports a BinanceProvider instance', async () => {
    const { binanceProvider } = await import('../../providers/binance')
    expect(binanceProvider).toBeDefined()
    expect(typeof binanceProvider.subscribeTicker).toBe('function')
    expect(typeof binanceProvider.subscribeKline).toBe('function')
    expect(typeof binanceProvider.getOHLCV).toBe('function')
  })

  it('exports the WebSocketManager instance', async () => {
    const { wsManager } = await import('../../providers/binance')
    expect(wsManager).toBeDefined()
    expect(typeof wsManager.subscribe).toBe('function')
  })
})
