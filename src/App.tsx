import { useCallback, useEffect, useRef } from 'react'
import { PanelGrid } from './panel-system'
import { registerPanel } from './panel-system/registry'
import { useLayoutStore } from './stores/layoutStore'
import { WatchlistPanel } from './panels/watchlist/WatchlistPanel'
import { ChartPanel } from './panels/chart/ChartPanel'
import type { LinkColor } from './types'

registerPanel('watchlist', WatchlistPanel)
registerPanel('chart', ChartPanel)

function App() {
  const layout = useLayoutStore((s) => s.layout)
  const linkGroups = useLayoutStore((s) => s.linkGroups)
  const removePanel = useLayoutStore((s) => s.removePanel)
  const resizePanel = useLayoutStore((s) => s.resizePanel)
  const broadcastSymbol = useLayoutStore((s) => s.broadcastSymbol)
  const loadLayout = useLayoutStore((s) => s.loadLayout)
  const saveLayout = useLayoutStore((s) => s.saveLayout)
  const hasLoaded = useRef(false)

  useEffect(() => {
    loadLayout()
    hasLoaded.current = true
  }, [loadLayout])

  useEffect(() => {
    if (hasLoaded.current) saveLayout()
  }, [layout, saveLayout])

  // Reactive: re-derives when linkGroups changes (subscribed above)
  const getLinkedSymbol = useCallback(
    (color: LinkColor) => linkGroups.find((g) => g.color === color)?.activeSymbol ?? null,
    [linkGroups],
  )

  return (
    <div id="terminal-root" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PanelGrid
        layout={layout}
        onClose={removePanel}
        onResize={resizePanel}
        getLinkedSymbol={getLinkedSymbol}
        onSymbolSelect={broadcastSymbol}
        isOnlyPanel={layout.type === 'panel'}
      />
    </div>
  )
}

export default App
