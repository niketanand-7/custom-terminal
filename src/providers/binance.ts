import { WebSocketManager } from '../services/WebSocketManager'
import { BinanceProvider } from './BinanceProvider'
import { useMarketStore } from '../stores/marketStore'

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws'

export const wsManager = new WebSocketManager(BINANCE_WS_URL, {
  onStatusChange: (status) => {
    useMarketStore.getState().setConnectionStatus(status)
  },
})

export const binanceProvider = new BinanceProvider(wsManager)
