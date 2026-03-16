import type { PanelProps } from '../../types'

export function WatchlistPanel({ panelId, linkedSymbol }: PanelProps) {
  return <div data-testid={`watchlist-${panelId}`}>Watchlist {linkedSymbol ?? 'unlinked'}</div>
}
