import { useCallback, useRef } from 'react'
import type { LayoutNode, LinkColor } from '../types'
import { PanelShell } from './PanelShell'
import { Splitter } from './Splitter'

const MIN_PANEL_WIDTH = 120
const MIN_PANEL_HEIGHT = 80

type PanelGridProps = {
  layout: LayoutNode
  path?: number[]
  onClose: (panelId: string) => void
  onResize: (path: number[], sizes: number[]) => void
  getLinkedSymbol: (color: LinkColor) => string | null
  onSymbolSelect: (color: LinkColor, symbol: string) => void
  isOnlyPanel: boolean
}

export function PanelGrid({
  layout,
  path = [],
  onClose,
  onResize,
  getLinkedSymbol,
  onSymbolSelect,
  isOnlyPanel,
}: PanelGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  if (layout.type === 'panel') {
    const linkedSymbol = layout.linkColor ? getLinkedSymbol(layout.linkColor) : null
    const handleSymbolSelect = layout.linkColor
      ? (symbol: string) => onSymbolSelect(layout.linkColor!, symbol)
      : () => {}

    return (
      <PanelShell
        panelId={layout.panelId}
        panelType={layout.panelType}
        onClose={onClose}
        linkColor={layout.linkColor}
        linkedSymbol={linkedSymbol}
        onSymbolSelect={handleSymbolSelect}
        isLastPanel={isOnlyPanel}
      />
    )
  }

  const isRow = layout.type === 'row'
  const totalPanels = countPanels(layout)

  const handleSplitterResize = useCallback(
    (index: number, deltaPx: number) => {
      if (!containerRef.current) return
      const containerSize = isRow
        ? containerRef.current.offsetWidth
        : containerRef.current.offsetHeight
      if (containerSize === 0) return

      const deltaFraction = deltaPx / containerSize
      const newSizes = [...layout.sizes]
      newSizes[index] += deltaFraction
      newSizes[index + 1] -= deltaFraction

      const minPx = isRow ? MIN_PANEL_WIDTH : MIN_PANEL_HEIGHT
      const minFraction = minPx / containerSize
      if (newSizes[index] < minFraction || newSizes[index + 1] < minFraction) return

      onResize(path, newSizes)
    },
    [isRow, layout.sizes, onResize, path],
  )

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        height: '100%',
        width: '100%',
      }}
    >
      {layout.children.map((child, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div style={{ flex: layout.sizes[i], overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
            <PanelGrid
              layout={child}
              path={[...path, i]}
              onClose={onClose}
              onResize={onResize}
              getLinkedSymbol={getLinkedSymbol}
              onSymbolSelect={onSymbolSelect}
              isOnlyPanel={totalPanels === 1}
            />
          </div>
          {i < layout.children.length - 1 && (
            <Splitter direction={layout.type} onResize={(delta) => handleSplitterResize(i, delta)} />
          )}
        </div>
      ))}
    </div>
  )
}

function countPanels(node: LayoutNode): number {
  if (node.type === 'panel') return 1
  return node.children.reduce((sum, child) => sum + countPanels(child), 0)
}
