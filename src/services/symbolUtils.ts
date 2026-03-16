// src/services/symbolUtils.ts

const QUOTE_CURRENCIES = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'] as const

/**
 * Convert internal "BTC/USDT" → Binance "btcusdt"
 */
export function toBinanceSymbol(internal: string): string {
  return internal.replace('/', '').toLowerCase()
}

/**
 * Convert Binance "btcusdt" → internal "BTC/USDT"
 * Tries known quote currencies to find the split point.
 */
export function toInternalSymbol(binance: string): string {
  const upper = binance.toUpperCase()
  for (const quote of QUOTE_CURRENCIES) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, -quote.length)
      return `${base}/${quote}`
    }
  }
  // Fallback: assume last 4 chars are quote (covers most Binance pairs)
  const base = upper.slice(0, -4)
  const quote = upper.slice(-4)
  return `${base}/${quote}`
}
