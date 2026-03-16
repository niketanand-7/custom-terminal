// src/providers/types.ts
import type { Tick, Candle, Timeframe, Unsubscribe } from '../types'

export interface MarketDataProvider {
  subscribeTicker(symbol: string, callback: (tick: Tick) => void): Unsubscribe
  getOHLCV(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>
  subscribeKline(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): Unsubscribe
}
