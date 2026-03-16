import type { PanelProps } from '../../types'

export function WatchlistPanel({ panelId, linkedSymbol }: PanelProps) {
  return (
    <div
      data-testid={`watchlist-${panelId}`}
      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: 12 }}
    >
      Watchlist {linkedSymbol ?? 'unlinked'}
    </div>
  )
}
