// src/providers/BinanceProvider.ts
import type { MarketDataProvider } from './types'
import type { Tick, Candle, Timeframe, Unsubscribe } from '../types'
import type { UTCTimestamp } from 'lightweight-charts'
import { WebSocketManager } from '../services/WebSocketManager'
import { fetchWithRetry } from '../services/fetchWithRetry'
import { toBinanceSymbol } from '../services/symbolUtils'

const BINANCE_REST_URL = 'https://api.binance.com/api/v3'

export class BinanceProvider implements MarketDataProvider {
  private wsManager: WebSocketManager

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager
  }

  subscribeTicker(symbol: string, callback: (tick: Tick) => void): Unsubscribe {
    const binanceSymbol = toBinanceSymbol(symbol)
    const stream = `${binanceSymbol}@ticker`

    return this.wsManager.subscribe(stream, (data: unknown) => {
      const msg = data as Record<string, unknown>
      if (msg.e !== '24hrTicker') return
      if ((msg.s as string).toLowerCase() !== binanceSymbol) return

      callback({
        symbol,
        price: parseFloat(msg.c as string),
        change24h: parseFloat(msg.P as string),
        high24h: parseFloat(msg.h as string),
        low24h: parseFloat(msg.l as string),
        volume24h: parseFloat(msg.v as string),
        timestamp: msg.E as number,
      })
    })
  }

  subscribeKline(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): Unsubscribe {
    const binanceSymbol = toBinanceSymbol(symbol)
    const stream = `${binanceSymbol}@kline_${timeframe}`

    return this.wsManager.subscribe(stream, (data: unknown) => {
      const msg = data as Record<string, unknown>
      if (msg.e !== 'kline') return
      if ((msg.s as string).toLowerCase() !== binanceSymbol) return

      const k = msg.k as Record<string, unknown>
      callback({
        time: ((k.t as number) / 1000) as UTCTimestamp,
        open: parseFloat(k.o as string),
        high: parseFloat(k.h as string),
        low: parseFloat(k.l as string),
        close: parseFloat(k.c as string),
        volume: parseFloat(k.v as string),
      })
    })
  }

  async getOHLCV(symbol: string, timeframe: Timeframe, limit = 500): Promise<Candle[]> {
    const binanceSymbol = toBinanceSymbol(symbol).toUpperCase()
    const url = `${BINANCE_REST_URL}/klines?symbol=${binanceSymbol}&interval=${timeframe}&limit=${limit}`

    const response = await fetchWithRetry(url)
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as unknown[][]
    return data.map((k) => ({
      time: ((k[0] as number) / 1000) as UTCTimestamp,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }))
  }
}
