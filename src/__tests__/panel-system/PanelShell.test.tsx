import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelShell } from '../../panel-system/PanelShell'
import { registerPanel } from '../../panel-system/registry'
import type { PanelProps } from '../../types'

function MockPanel({ panelId }: PanelProps) {
  return <div data-testid={`mock-${panelId}`}>Mock Panel</div>
}

describe('PanelShell', () => {
  beforeEach(() => {
    registerPanel('chart', MockPanel)
  })

  it('renders the registered panel component', () => {
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={vi.fn()} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    expect(screen.getByTestId('mock-p1')).toBeDefined()
  })

  it('displays panel type in title bar', () => {
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={vi.fn()} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    expect(screen.getByText('CHART')).toBeDefined()
  })

  it('displays panel type with linked symbol in title bar', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkColor="amber"
        linkedSymbol="BTC/USDT"
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('CHART BTC/USDT')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={onClose} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledWith('p1')
  })

  it('hides close button when isLastPanel is true', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkedSymbol={null}
        onSymbolSelect={vi.fn()}
        isLastPanel
      />,
    )
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  it('shows link color indicator when linkColor is provided', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkColor="amber"
        linkedSymbol="BTC/USDT"
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('link-indicator')).toBeDefined()
  })

  it('renders fallback for unregistered panel type', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="watchlist"
        onClose={vi.fn()}
        linkedSymbol={null}
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(/unknown panel/i)).toBeDefined()
  })
})
