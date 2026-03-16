// src/__tests__/services/symbolUtils.test.ts
import { describe, it, expect } from 'vitest'
import { toInternalSymbol, toBinanceSymbol } from '../../services/symbolUtils'

describe('toBinanceSymbol', () => {
  it('converts BTC/USDT to btcusdt', () => {
    expect(toBinanceSymbol('BTC/USDT')).toBe('btcusdt')
  })

  it('converts ETH/USDT to ethusdt', () => {
    expect(toBinanceSymbol('ETH/USDT')).toBe('ethusdt')
  })

  it('handles mixed case input', () => {
    expect(toBinanceSymbol('sol/usdt')).toBe('solusdt')
  })
})

describe('toInternalSymbol', () => {
  it('converts btcusdt to BTC/USDT', () => {
    expect(toInternalSymbol('btcusdt')).toBe('BTC/USDT')
  })

  it('converts ethusdt to ETH/USDT', () => {
    expect(toInternalSymbol('ethusdt')).toBe('ETH/USDT')
  })

  it('converts SOLUSDT to SOL/USDT', () => {
    expect(toInternalSymbol('SOLUSDT')).toBe('SOL/USDT')
  })

  it('handles BTCBUSD', () => {
    expect(toInternalSymbol('btcbusd')).toBe('BTC/BUSD')
  })

  it('falls back to last 4 chars for unknown quote', () => {
    expect(toInternalSymbol('abcdefg1234')).toBe('ABCDEFG/1234')
  })
})
