export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'

export type Tick = {
  symbol: string
  price: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: number
  timestamp: number
}

import type { UTCTimestamp } from 'lightweight-charts'

export type Candle = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type CoinMetadata = {
  symbol: string
  name: string
  logoUrl: string | null
  marketCap: number | null
  description: string | null
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

export type Unsubscribe = () => void
