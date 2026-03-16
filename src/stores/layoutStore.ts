import { create } from 'zustand'
import type { LayoutNode, LinkGroup, LinkColor, PanelType } from '../types'
import {
  removePanelNode,
  addPanelToLayout,
  generatePanelId,
  updateSizesAtPath,
} from '../panel-system/layoutUtils'

const STORAGE_KEY = 'terminal-layout'

export const DEFAULT_LAYOUT: LayoutNode = {
  type: 'row',
  children: [
    { type: 'panel', panelId: 'panel-default-watchlist', panelType: 'watchlist', linkColor: 'amber' },
    { type: 'panel', panelId: 'panel-default-chart', panelType: 'chart', linkColor: 'amber' },
  ],
  sizes: [0.3, 0.7],
}

type LayoutState = {
  layout: LayoutNode
  linkGroups: LinkGroup[]
  removePanel: (panelId: string) => void
  addPanel: (panelType: PanelType, linkColor?: LinkColor) => void
  resizePanel: (path: number[], sizes: number[]) => void
  broadcastSymbol: (color: LinkColor, symbol: string) => void
  saveLayout: () => void
  loadLayout: () => void
}

const useLayoutStoreBase = create<LayoutState>()((set) => ({
  layout: DEFAULT_LAYOUT,
  linkGroups: [],

  removePanel: (panelId: string) =>
    set((state) => {
      const result = removePanelNode(state.layout, panelId)
      if (result === null) return state
      return { layout: result }
    }),

  addPanel: (panelType: PanelType, linkColor?: LinkColor) =>
    set((state) => ({
      layout: addPanelToLayout(state.layout, generatePanelId(), panelType, linkColor),
    })),

  resizePanel: (path: number[], sizes: number[]) =>
    set((state) => ({
      layout: updateSizesAtPath(state.layout, path, sizes),
    })),

  broadcastSymbol: (color: LinkColor, symbol: string) =>
    set((state) => {
      const existing = state.linkGroups.find((g) => g.color === color)
      if (existing) {
        return {
          linkGroups: state.linkGroups.map((g) =>
            g.color === color ? { ...g, activeSymbol: symbol } : g,
          ),
        }
      }
      return { linkGroups: [...state.linkGroups, { color, activeSymbol: symbol }] }
    }),

  saveLayout: () => {
    const { layout, linkGroups } = useLayoutStoreBase.getState()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout, linkGroups }))
    } catch {
      // localStorage quota exceeded — silently ignore
    }
  },

  loadLayout: () =>
    set(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return { layout: DEFAULT_LAYOUT, linkGroups: [] }
        const parsed = JSON.parse(stored)
        if (!parsed.layout) return { layout: DEFAULT_LAYOUT, linkGroups: [] }
        return { layout: parsed.layout, linkGroups: parsed.linkGroups ?? [] }
      } catch {
        return { layout: DEFAULT_LAYOUT, linkGroups: [] }
      }
    }),
}))

// Preserve action functions when setState is called with replace=true (zustand v5 compatibility)
const originalSetState = useLayoutStoreBase.setState.bind(useLayoutStoreBase)
const actions = (() => {
  const s = useLayoutStoreBase.getState()
  return {
    removePanel: s.removePanel,
    addPanel: s.addPanel,
    resizePanel: s.resizePanel,
    broadcastSymbol: s.broadcastSymbol,
    saveLayout: s.saveLayout,
    loadLayout: s.loadLayout,
  }
})()

useLayoutStoreBase.setState = (partial, replace) => {
  if (replace) {
    const next = typeof partial === 'function' ? partial(useLayoutStoreBase.getState()) : partial
    originalSetState({ ...actions, ...next } as LayoutState, true)
  } else {
    originalSetState(partial as Partial<LayoutState>, false)
  }
}

export const useLayoutStore = useLayoutStoreBase

export function selectLinkedSymbol(color: LinkColor) {
  return (state: LayoutState) =>
    state.linkGroups.find((g) => g.color === color)?.activeSymbol ?? null
}
