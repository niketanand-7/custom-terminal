export type LinkColor = 'amber' | 'green' | 'blue' | 'red'

export type LinkGroup = {
  color: LinkColor
  activeSymbol: string | null
}

export type PanelConfig = Record<string, unknown>

export type LayoutNode =
  | { type: 'panel'; panelId: string; panelType: string; linkColor?: LinkColor; config?: PanelConfig }
  | { type: 'row' | 'column'; children: LayoutNode[]; sizes: number[] }

export type PanelProps = {
  panelId: string
  linkedSymbol: string | null
  onSymbolSelect: (symbol: string) => void
}
