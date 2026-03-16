import { getPanel } from './registry'
import type { PanelType, LinkColor } from '../types'

type PanelShellProps = {
  panelId: string
  panelType: PanelType
  onClose: (panelId: string) => void
  linkColor?: LinkColor
  linkedSymbol: string | null
  onSymbolSelect: (symbol: string) => void
  isLastPanel?: boolean
}

export function PanelShell({
  panelId,
  panelType,
  onClose,
  linkColor,
  linkedSymbol,
  onSymbolSelect,
  isLastPanel,
}: PanelShellProps) {
  const PanelComponent = getPanel(panelType)
  const title = linkedSymbol
    ? `${panelType.toUpperCase()} ${linkedSymbol}`
    : panelType.toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {linkColor && (
            <span data-testid="link-indicator" style={{ width: 8, height: 8, borderRadius: '50%' }} />
          )}
          <span>{title}</span>
        </div>
        {!isLastPanel && (
          <button aria-label="Close panel" onClick={() => onClose(panelId)}>
            &times;
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {PanelComponent ? (
          <PanelComponent panelId={panelId} linkedSymbol={linkedSymbol} onSymbolSelect={onSymbolSelect} />
        ) : (
          <div>Unknown panel type: {panelType}</div>
        )}
      </div>
    </div>
  )
}
