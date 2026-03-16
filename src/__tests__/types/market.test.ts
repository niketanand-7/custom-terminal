import { describe, it, expectTypeOf } from 'vitest'
import type { Timeframe, Tick, Candle, CoinMetadata, Unsubscribe } from '../../types/market'

describe('market types', () => {
  it('Timeframe accepts all valid intervals', () => {
    expectTypeOf<'1m'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'5m'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'15m'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'1h'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'4h'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'1d'>().toMatchTypeOf<Timeframe>()
    expectTypeOf<'1w'>().toMatchTypeOf<Timeframe>()
  })

  it('Tick has all required fields with correct types', () => {
    expectTypeOf<Tick>().toHaveProperty('symbol').toBeString()
    expectTypeOf<Tick>().toHaveProperty('price').toBeNumber()
    expectTypeOf<Tick>().toHaveProperty('change24h').toBeNumber()
    expectTypeOf<Tick>().toHaveProperty('high24h').toBeNumber()
    expectTypeOf<Tick>().toHaveProperty('low24h').toBeNumber()
    expectTypeOf<Tick>().toHaveProperty('volume24h').toBeNumber()
    expectTypeOf<Tick>().toHaveProperty('timestamp').toBeNumber()
  })

  it('Candle has OHLCV fields', () => {
    expectTypeOf<Candle>().toHaveProperty('time').toBeNumber()
    expectTypeOf<Candle>().toHaveProperty('open').toBeNumber()
    expectTypeOf<Candle>().toHaveProperty('high').toBeNumber()
    expectTypeOf<Candle>().toHaveProperty('low').toBeNumber()
    expectTypeOf<Candle>().toHaveProperty('close').toBeNumber()
    expectTypeOf<Candle>().toHaveProperty('volume').toBeNumber()
  })

  it('CoinMetadata has nullable optional fields', () => {
    expectTypeOf<CoinMetadata>().toHaveProperty('symbol').toBeString()
    expectTypeOf<CoinMetadata>().toHaveProperty('name').toBeString()
    expectTypeOf<CoinMetadata>().toHaveProperty('logoUrl').toEqualTypeOf<string | null>()
    expectTypeOf<CoinMetadata>().toHaveProperty('marketCap').toEqualTypeOf<number | null>()
    expectTypeOf<CoinMetadata>().toHaveProperty('description').toEqualTypeOf<string | null>()
  })

  it('Unsubscribe is a void function', () => {
    expectTypeOf<Unsubscribe>().toBeFunction()
    expectTypeOf<Unsubscribe>().returns.toBeVoid()
  })
})
