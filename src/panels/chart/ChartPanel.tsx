import type { PanelProps } from '../../types'

export function ChartPanel({ panelId, linkedSymbol }: PanelProps) {
  return <div data-testid={`chart-${panelId}`}>Chart {linkedSymbol ?? 'BTC/USDT'}</div>
}
