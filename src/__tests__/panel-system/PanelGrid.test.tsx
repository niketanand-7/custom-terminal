import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelGrid } from '../../panel-system/PanelGrid'
import { registerPanel } from '../../panel-system/registry'
import type { LayoutNode, PanelProps } from '../../types'

function MockChart({ panelId }: PanelProps) {
  return <div data-testid={`chart-${panelId}`}>Chart</div>
}

function MockWatchlist({ panelId }: PanelProps) {
  return <div data-testid={`watchlist-${panelId}`}>Watchlist</div>
}

describe('PanelGrid', () => {
  beforeEach(() => {
    registerPanel('chart', MockChart)
    registerPanel('watchlist', MockWatchlist)
  })

  it('renders a single panel', () => {
    const layout: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel
      />,
    )
    expect(screen.getByTestId('chart-p1')).toBeDefined()
  })

  it('renders a row with two panels and a splitter', () => {
    const layout: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
      ],
      sizes: [0.3, 0.7],
    }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel={false}
      />,
    )
    expect(screen.getByTestId('watchlist-p1')).toBeDefined()
    expect(screen.getByTestId('chart-p2')).toBeDefined()
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('renders a 3-level nested layout (row > column > 2 panels)', () => {
    const layout: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        {
          type: 'column',
          children: [
            { type: 'panel', panelId: 'p2', panelType: 'chart' },
            { type: 'panel', panelId: 'p3', panelType: 'chart' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.3, 0.7],
    }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel={false}
      />,
    )
    expect(screen.getByTestId('watchlist-p1')).toBeDefined()
    expect(screen.getByTestId('chart-p2')).toBeDefined()
    expect(screen.getByTestId('chart-p3')).toBeDefined()
    // 1 splitter between row children + 1 between column children = 2
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })
})
