import type { PanelProps } from '../../types'

export function ChartPanel({ panelId, linkedSymbol }: PanelProps) {
  return (
    <div
      data-testid={`chart-${panelId}`}
      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: 12 }}
    >
      Chart {linkedSymbol ?? 'BTC/USDT'}
    </div>
  )
}
