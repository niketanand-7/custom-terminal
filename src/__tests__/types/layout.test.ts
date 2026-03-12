import { describe, it, expectTypeOf } from 'vitest'
import type { LinkColor, LinkGroup, PanelConfig, LayoutNode, PanelProps } from '../../types/layout'

describe('layout types', () => {
  it('LinkColor accepts all four colors', () => {
    expectTypeOf<'amber'>().toMatchTypeOf<LinkColor>()
    expectTypeOf<'green'>().toMatchTypeOf<LinkColor>()
    expectTypeOf<'blue'>().toMatchTypeOf<LinkColor>()
    expectTypeOf<'red'>().toMatchTypeOf<LinkColor>()
  })

  it('LinkGroup has color and nullable activeSymbol', () => {
    expectTypeOf<LinkGroup>().toHaveProperty('color').toEqualTypeOf<LinkColor>()
    expectTypeOf<LinkGroup>().toHaveProperty('activeSymbol').toEqualTypeOf<string | null>()
  })

  it('PanelConfig is a record of unknown values', () => {
    expectTypeOf<PanelConfig>().toMatchTypeOf<Record<string, unknown>>()
  })

  it('LayoutNode panel variant has required fields', () => {
    const panelNode: LayoutNode = {
      type: 'panel',
      panelId: 'p1',
      panelType: 'watchlist',
    }
    expectTypeOf(panelNode).toMatchTypeOf<LayoutNode>()
  })

  it('LayoutNode panel variant accepts optional linkColor and config', () => {
    const linked: LayoutNode = {
      type: 'panel',
      panelId: 'p1',
      panelType: 'chart',
      linkColor: 'amber',
      config: { symbol: 'BTC/USDT' },
    }
    expectTypeOf(linked).toMatchTypeOf<LayoutNode>()
  })

  it('LayoutNode split variant has children and sizes', () => {
    const row: LayoutNode = {
      type: 'row',
      children: [],
      sizes: [],
    }
    expectTypeOf(row).toMatchTypeOf<LayoutNode>()

    const col: LayoutNode = {
      type: 'column',
      children: [],
      sizes: [],
    }
    expectTypeOf(col).toMatchTypeOf<LayoutNode>()
  })

  it('PanelProps has correct field types', () => {
    expectTypeOf<PanelProps>().toHaveProperty('panelId').toBeString()
    expectTypeOf<PanelProps>().toHaveProperty('linkedSymbol').toEqualTypeOf<string | null>()
    expectTypeOf<PanelProps>().toHaveProperty('onSymbolSelect').toBeFunction()
  })
})
