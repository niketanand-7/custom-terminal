import { getPanel } from './registry'
import type { PanelType, LinkColor } from '../types'
import './PanelShell.css'

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
    <div className="panel-shell">
      <div className="panel-titlebar">
        <div className="panel-titlebar__left">
          {linkColor && (
            <span className="panel-link-dot" data-testid="link-indicator" data-color={linkColor} />
          )}
          <span className="panel-titlebar__title">{title}</span>
        </div>
        {!isLastPanel && (
          <button className="panel-close-btn" aria-label="Close panel" onClick={() => onClose(panelId)}>
            &times;
          </button>
        )}
      </div>
      <div className="panel-content">
        {PanelComponent ? (
          <PanelComponent panelId={panelId} linkedSymbol={linkedSymbol} onSymbolSelect={onSymbolSelect} />
        ) : (
          <div>Unknown panel type: {panelType}</div>
        )}
      </div>
    </div>
  )
}
