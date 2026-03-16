// src/__tests__/providers/BinanceProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BinanceProvider } from '../../providers/BinanceProvider'
import type { WebSocketManager } from '../../services/WebSocketManager'
import * as fetchModule from '../../services/fetchWithRetry'
import type { UTCTimestamp } from 'lightweight-charts'

// Mock fetchWithRetry
vi.mock('../../services/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn(),
}))

describe('BinanceProvider', () => {
  let provider: BinanceProvider
  let mockWsManager: { subscribe: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWsManager = {
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      destroy: vi.fn(),
    }
    provider = new BinanceProvider(mockWsManager as unknown as WebSocketManager)
  })

  describe('subscribeTicker', () => {
    it('subscribes to the correct Binance stream', () => {
      const cb = vi.fn()
      provider.subscribeTicker('BTC/USDT', cb)
      expect(mockWsManager.subscribe).toHaveBeenCalledWith(
        'btcusdt@ticker',
        expect.any(Function),
      )
    })

    it('parses 24hrTicker event into Tick', () => {
      const cb = vi.fn()
      provider.subscribeTicker('BTC/USDT', cb)

      // Get the internal callback passed to wsManager.subscribe
      const internalCb = mockWsManager.subscribe.mock.calls[0][1]

      // Simulate a Binance 24hrTicker message
      internalCb({
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: '50000.50',        // close price (last price)
        P: '2.5',             // 24h price change percent
        h: '51000',           // 24h high
        l: '49000',           // 24h low
        v: '1000000',         // 24h volume
        E: 1700000000000,     // event time
      })

      expect(cb).toHaveBeenCalledWith({
        symbol: 'BTC/USDT',
        price: 50000.50,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        volume24h: 1000000,
        timestamp: 1700000000000,
      })
    })

    it('ignores messages for other symbols', () => {
      const cb = vi.fn()
      provider.subscribeTicker('BTC/USDT', cb)
      const internalCb = mockWsManager.subscribe.mock.calls[0][1]

      internalCb({
        e: '24hrTicker',
        s: 'ETHUSDT',
        c: '2000',
        P: '1.0',
        h: '2100',
        l: '1900',
        v: '500000',
        E: 1700000000000,
      })

      expect(cb).not.toHaveBeenCalled()
    })

    it('ignores non-ticker events', () => {
      const cb = vi.fn()
      provider.subscribeTicker('BTC/USDT', cb)
      const internalCb = mockWsManager.subscribe.mock.calls[0][1]

      internalCb({ result: null, id: 1 }) // subscription confirmation
      expect(cb).not.toHaveBeenCalled()
    })

    it('returns unsubscribe function', () => {
      const unsub = vi.fn()
      mockWsManager.subscribe.mockReturnValue(unsub)

      const cb = vi.fn()
      const result = provider.subscribeTicker('BTC/USDT', cb)
      result()

      expect(unsub).toHaveBeenCalled()
    })
  })

  describe('subscribeKline', () => {
    it('subscribes to the correct Binance kline stream', () => {
      const cb = vi.fn()
      provider.subscribeKline('ETH/USDT', '1h', cb)
      expect(mockWsManager.subscribe).toHaveBeenCalledWith(
        'ethusdt@kline_1h',
        expect.any(Function),
      )
    })

    it('parses kline event into Candle', () => {
      const cb = vi.fn()
      provider.subscribeKline('BTC/USDT', '1h', cb)
      const internalCb = mockWsManager.subscribe.mock.calls[0][1]

      internalCb({
        e: 'kline',
        s: 'BTCUSDT',
        k: {
          t: 1700000000000,   // kline open time
          o: '50000',
          h: '51000',
          l: '49000',
          c: '50500',
          v: '100',
        },
      })

      expect(cb).toHaveBeenCalledWith({
        time: (1700000000000 / 1000) as UTCTimestamp,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 100,
      })
    })

    it('ignores kline messages for other symbols', () => {
      const cb = vi.fn()
      provider.subscribeKline('BTC/USDT', '1h', cb)
      const internalCb = mockWsManager.subscribe.mock.calls[0][1]

      internalCb({
        e: 'kline',
        s: 'ETHUSDT',
        k: { t: 1700000000000, o: '2000', h: '2100', l: '1900', c: '2050', v: '50' },
      })

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('getOHLCV', () => {
    it('fetches and parses candles from Binance REST API', async () => {
      const mockCandles = [
        [1700000000000, '50000', '51000', '49000', '50500', '100', 1700003600000, '5000000', 200, '60', '3000000', '0'],
        [1700003600000, '50500', '52000', '50000', '51500', '120', 1700007200000, '6000000', 250, '70', '3500000', '0'],
      ]
      vi.mocked(fetchModule.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCandles),
      } as Response)

      const result = await provider.getOHLCV('BTC/USDT', '1h', 2)

      expect(fetchModule.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('api.binance.com/api/v3/klines'),
      )
      expect(fetchModule.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('symbol=BTCUSDT'),
      )
      expect(fetchModule.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('interval=1h'),
      )
      expect(fetchModule.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('limit=2'),
      )

      expect(result).toEqual([
        { time: (1700000000000 / 1000) as UTCTimestamp, open: 50000, high: 51000, low: 49000, close: 50500, volume: 100 },
        { time: (1700003600000 / 1000) as UTCTimestamp, open: 50500, high: 52000, low: 50000, close: 51500, volume: 120 },
      ])
    })

    it('defaults to 500 candles when limit not specified', async () => {
      vi.mocked(fetchModule.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)

      await provider.getOHLCV('BTC/USDT', '1h')

      expect(fetchModule.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('limit=500'),
      )
    })

    it('throws on non-ok response', async () => {
      vi.mocked(fetchModule.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)

      await expect(provider.getOHLCV('BTC/USDT', '1h')).rejects.toThrow()
    })
  })
})
