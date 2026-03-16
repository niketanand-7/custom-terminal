import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore, DEFAULT_LAYOUT, selectLinkedSymbol } from '../../stores/layoutStore'
import type { LayoutNode } from '../../types'

describe('layoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({ layout: DEFAULT_LAYOUT, linkGroups: [] } as never, true)
    localStorage.clear()
  })

  it('has a default layout with watchlist and chart', () => {
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('row')
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.children).toHaveLength(2)
      expect(layout.sizes).toEqual([0.3, 0.7])
      const left = layout.children[0]
      const right = layout.children[1]
      expect(left.type).toBe('panel')
      expect(right.type).toBe('panel')
      if (left.type === 'panel') {
        expect(left.panelType).toBe('watchlist')
        expect(left.linkColor).toBe('amber')
      }
      if (right.type === 'panel') {
        expect(right.panelType).toBe('chart')
        expect(right.linkColor).toBe('amber')
      }
    }
  })

  it('has default link groups as empty array', () => {
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toEqual([])
  })

  it('removePanel removes a panel and collapses single child', () => {
    const { removePanel } = useLayoutStore.getState()
    removePanel('panel-default-watchlist')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('panel')
    if (layout.type === 'panel') {
      expect(layout.panelType).toBe('chart')
    }
  })

  it('removePanel does not remove the last panel', () => {
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'p1', panelType: 'chart' },
    })
    const { removePanel } = useLayoutStore.getState()
    removePanel('p1')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('panel')
    if (layout.type === 'panel') expect(layout.panelId).toBe('p1')
  })

  it('addPanel splits the rightmost panel', () => {
    const { addPanel } = useLayoutStore.getState()
    addPanel('chart')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('row')
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.children[0].type).toBe('panel')
      expect(layout.children[1].type).toBe('row')
    }
  })

  it('resizePanel updates sizes at root path', () => {
    const { resizePanel } = useLayoutStore.getState()
    resizePanel([], [0.4, 0.6])
    const { layout } = useLayoutStore.getState()
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.sizes[0]).toBeCloseTo(0.4)
      expect(layout.sizes[1]).toBeCloseTo(0.6)
    }
  })

  it('broadcastSymbol creates a link group lazily', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('amber', 'BTC/USDT')
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toEqual([{ color: 'amber', activeSymbol: 'BTC/USDT' }])
  })

  it('broadcastSymbol updates existing link group', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('amber', 'BTC/USDT')
    broadcastSymbol('amber', 'ETH/USDT')
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toHaveLength(1)
    expect(linkGroups[0]).toEqual({ color: 'amber', activeSymbol: 'ETH/USDT' })
  })

  it('selectLinkedSymbol returns the active symbol for a color', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('green', 'SOL/USDT')
    const result = selectLinkedSymbol('green')(useLayoutStore.getState())
    expect(result).toBe('SOL/USDT')
  })

  it('selectLinkedSymbol returns null for unknown color', () => {
    const result = selectLinkedSymbol('blue')(useLayoutStore.getState())
    expect(result).toBeNull()
  })

  it('saveLayout persists to localStorage', () => {
    const { saveLayout } = useLayoutStore.getState()
    saveLayout()
    const stored = localStorage.getItem('terminal-layout')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.layout.type).toBe('row')
    expect(parsed.linkGroups).toEqual([])
  })

  it('loadLayout restores from localStorage', () => {
    const custom: LayoutNode = { type: 'panel', panelId: 'custom', panelType: 'chart' }
    localStorage.setItem(
      'terminal-layout',
      JSON.stringify({ layout: custom, linkGroups: [{ color: 'amber', activeSymbol: 'ETH/USDT' }] }),
    )
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout, linkGroups } = useLayoutStore.getState()
    expect(layout).toEqual(custom)
    expect(linkGroups).toEqual([{ color: 'amber', activeSymbol: 'ETH/USDT' }])
  })

  it('loadLayout falls back to default on invalid JSON', () => {
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'mutated', panelType: 'chart' },
    })
    localStorage.setItem('terminal-layout', 'not json')
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout } = useLayoutStore.getState()
    expect(layout).toEqual(DEFAULT_LAYOUT)
  })

  it('loadLayout falls back to default on missing key', () => {
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'mutated', panelType: 'chart' },
    })
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout } = useLayoutStore.getState()
    expect(layout).toEqual(DEFAULT_LAYOUT)
  })
})
