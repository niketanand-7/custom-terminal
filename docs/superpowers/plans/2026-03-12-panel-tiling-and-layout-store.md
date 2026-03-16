# Panel Tiling System & Layout Store Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the panel tiling engine and Zustand layout store so panels can be rendered in a recursive row/column grid with resizable dividers, panel close/add, link group coordination, and localStorage persistence.

**Architecture:** A recursive `PanelGrid` component renders the `LayoutNode` tree — leaf nodes become `PanelShell` wrappers, split nodes become flex containers with `Splitter` dividers between children. All layout mutations flow through a Zustand `layoutStore` which persists to localStorage. A `panelRegistry` maps `PanelType` strings to React components. Panels receive props via `PanelShell`, which resolves link group state.

**Tech Stack:** React 19, TypeScript, Zustand 5, Vitest + @testing-library/react, jsdom

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/stores/layoutStore.ts` | Zustand store: layout tree state, link groups, all mutations (add/remove/resize/link), localStorage persistence |
| `src/panel-system/registry.ts` | Map of `PanelType` to React component; `getPanel()` lookup |
| `src/panel-system/PanelGrid.tsx` | Recursive renderer: walks `LayoutNode` tree, renders splits as flex containers, leaves as `PanelShell` |
| `src/panel-system/PanelShell.tsx` | Panel wrapper: title bar (with linked symbol), close button, link color indicator; renders registered component |
| `src/panel-system/Splitter.tsx` | Draggable divider between sibling panels; fires resize callback on drag |
| `src/panel-system/layoutUtils.ts` | Pure helper functions: `normalizeSizes`, `removePanelNode`, `findPanelNode`, `generatePanelId`, `addPanelToLayout`, `updateSizesAtPath` |
| `src/panel-system/index.ts` | Barrel export for panel-system |
| `src/__tests__/stores/layoutStore.test.ts` | Unit tests for layout store mutations and persistence |
| `src/__tests__/panel-system/layoutUtils.test.ts` | Unit tests for pure layout tree helpers |
| `src/__tests__/panel-system/registry.test.ts` | Unit tests for panel registry |
| `src/__tests__/panel-system/PanelGrid.test.tsx` | Integration tests for recursive rendering |
| `src/__tests__/panel-system/PanelShell.test.tsx` | Tests for shell rendering, close, link resolution |
| `src/__tests__/panel-system/Splitter.test.tsx` | Tests for drag-resize behavior |
| `src/panels/watchlist/WatchlistPanel.tsx` | Placeholder watchlist panel |
| `src/panels/chart/ChartPanel.tsx` | Placeholder chart panel |
| `src/App.tsx` | Modified: render `PanelGrid` from layout store |

---

## Chunk 1: Layout Utilities & Layout Store

### Task 1: Layout Utility Functions

**Files:**
- Create: `src/panel-system/layoutUtils.ts`
- Test: `src/__tests__/panel-system/layoutUtils.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeSizes`**

```ts
// src/__tests__/panel-system/layoutUtils.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeSizes } from '../../panel-system/layoutUtils'

describe('normalizeSizes', () => {
  it('normalizes sizes to sum to 1.0', () => {
    expect(normalizeSizes([3, 7])).toEqual([0.3, 0.7])
  })

  it('handles already-normalized sizes', () => {
    expect(normalizeSizes([0.5, 0.5])).toEqual([0.5, 0.5])
  })

  it('handles single element', () => {
    expect(normalizeSizes([1])).toEqual([1])
  })

  it('handles floating point drift', () => {
    const result = normalizeSizes([0.33, 0.33, 0.34])
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0)
  })

  it('handles zero-sum by distributing equally', () => {
    expect(normalizeSizes([0, 0])).toEqual([0.5, 0.5])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `normalizeSizes`**

```ts
// src/panel-system/layoutUtils.ts
import type { LayoutNode, PanelType, LinkColor } from '../types'

export function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0)
  if (total === 0) return sizes.map(() => 1 / sizes.length)
  return sizes.map(s => s / total)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `generatePanelId`**

Add to the same test file:

```ts
import { normalizeSizes, generatePanelId } from '../../panel-system/layoutUtils'

describe('generatePanelId', () => {
  it('returns a string starting with "panel-"', () => {
    const id = generatePanelId()
    expect(id).toMatch(/^panel-.+/)
  })

  it('returns unique ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePanelId()))
    expect(ids.size).toBe(100)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: FAIL — generatePanelId not exported

- [ ] **Step 7: Implement `generatePanelId`**

Add to `src/panel-system/layoutUtils.ts`:

```ts
let counter = 0

export function generatePanelId(): string {
  return `panel-${Date.now()}-${counter++}`
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing tests for `removePanelNode`**

Add to test file (update the import to include `removePanelNode`):

```ts
import { normalizeSizes, generatePanelId, removePanelNode } from '../../panel-system/layoutUtils'
import type { LayoutNode } from '../../types'

describe('removePanelNode', () => {
  it('returns null when removing the only panel (root)', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    expect(removePanelNode(root, 'p1')).toBeNull()
  })

  it('removes a panel from a row and collapses single child', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
      ],
      sizes: [0.3, 0.7],
    }
    const result = removePanelNode(root, 'p1')
    expect(result).toEqual({ type: 'panel', panelId: 'p2', panelType: 'chart' })
  })

  it('removes a panel from a row with 3 children and renormalizes', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
        { type: 'panel', panelId: 'p3', panelType: 'chart' },
      ],
      sizes: [0.2, 0.5, 0.3],
    }
    const result = removePanelNode(root, 'p2')!
    expect(result.type).toBe('row')
    if (result.type === 'row' || result.type === 'column') {
      expect(result.children).toHaveLength(2)
      expect(result.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0)
    }
  })

  it('removes a panel nested 3 levels deep and collapses correctly', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        {
          type: 'column',
          children: [
            { type: 'panel', panelId: 'p2', panelType: 'chart' },
            { type: 'panel', panelId: 'p3', panelType: 'chart' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.3, 0.7],
    }
    const result = removePanelNode(root, 'p2')!
    // The column collapses to just p3, so root becomes row with [p1, p3]
    expect(result.type).toBe('row')
    if (result.type === 'row' || result.type === 'column') {
      expect(result.children).toHaveLength(2)
      expect(result.children[1]).toEqual({ type: 'panel', panelId: 'p3', panelType: 'chart' })
    }
  })

  it('returns tree unchanged when panelId not found', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    expect(removePanelNode(root, 'nonexistent')).toEqual(root)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: FAIL — removePanelNode not exported

- [ ] **Step 11: Implement `removePanelNode`**

Add to `src/panel-system/layoutUtils.ts`:

```ts
export function removePanelNode(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.type === 'panel') {
    return node.panelId === panelId ? null : node
  }

  const newChildren: LayoutNode[] = []
  const newSizes: number[] = []

  for (let i = 0; i < node.children.length; i++) {
    const result = removePanelNode(node.children[i], panelId)
    if (result !== null) {
      newChildren.push(result)
      newSizes.push(node.sizes[i])
    }
  }

  if (newChildren.length === node.children.length) return node
  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]

  return { type: node.type, children: newChildren, sizes: normalizeSizes(newSizes) }
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: PASS

- [ ] **Step 13: Write failing tests for `addPanelToLayout`**

Add to test file (update import):

```ts
import { normalizeSizes, generatePanelId, removePanelNode, addPanelToLayout } from '../../panel-system/layoutUtils'

describe('addPanelToLayout', () => {
  it('splits a single root panel into a row', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    const result = addPanelToLayout(root, 'p2', 'watchlist')
    expect(result.type).toBe('row')
    if (result.type === 'row' || result.type === 'column') {
      expect(result.children).toHaveLength(2)
      expect(result.sizes).toEqual([0.5, 0.5])
    }
  })

  it('appends to the rightmost panel in a row, preserving outer sizes', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
      ],
      sizes: [0.3, 0.7],
    }
    const result = addPanelToLayout(root, 'p3', 'chart')
    expect(result.type).toBe('row')
    if (result.type === 'row' || result.type === 'column') {
      // Outer sizes must be preserved unchanged
      expect(result.sizes).toEqual([0.3, 0.7])
      expect(result.children).toHaveLength(2)
      const rightChild = result.children[1]
      expect(rightChild.type).toBe('row')
      if (rightChild.type === 'row' || rightChild.type === 'column') {
        expect(rightChild.children).toHaveLength(2)
        expect(rightChild.sizes).toEqual([0.5, 0.5])
      }
    }
  })
})
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: FAIL — addPanelToLayout not exported

- [ ] **Step 15: Implement `addPanelToLayout`**

Add to `src/panel-system/layoutUtils.ts`:

```ts
export function addPanelToLayout(
  node: LayoutNode,
  panelId: string,
  panelType: PanelType,
  linkColor?: LinkColor,
): LayoutNode {
  const newPanel: LayoutNode = { type: 'panel', panelId, panelType, linkColor }

  if (node.type === 'panel') {
    return { type: 'row', children: [node, newPanel], sizes: [0.5, 0.5] }
  }

  // Split the rightmost child
  const children = [...node.children]
  const sizes = [...node.sizes]
  const lastIndex = children.length - 1
  children[lastIndex] = addPanelToLayout(children[lastIndex], panelId, panelType, linkColor)

  return { type: node.type, children, sizes }
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: PASS

- [ ] **Step 17: Write failing tests for `findPanelNode` and `updateSizesAtPath`**

Add to test file (update import):

```ts
import {
  normalizeSizes, generatePanelId, removePanelNode,
  addPanelToLayout, findPanelNode, updateSizesAtPath,
} from '../../panel-system/layoutUtils'

describe('findPanelNode', () => {
  it('finds a panel at root level', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    expect(findPanelNode(root, 'p1')).toEqual(root)
  })

  it('finds a panel nested in a row', () => {
    const target: LayoutNode = { type: 'panel', panelId: 'p2', panelType: 'chart' }
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        target,
      ],
      sizes: [0.3, 0.7],
    }
    expect(findPanelNode(root, 'p2')).toEqual(target)
  })

  it('returns undefined when not found', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    expect(findPanelNode(root, 'missing')).toBeUndefined()
  })
})

describe('updateSizesAtPath', () => {
  it('updates sizes at root level', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
      ],
      sizes: [0.3, 0.7],
    }
    const result = updateSizesAtPath(root, [], [0.4, 0.6])
    if (result.type === 'row' || result.type === 'column') {
      expect(result.sizes[0]).toBeCloseTo(0.4)
      expect(result.sizes[1]).toBeCloseTo(0.6)
    }
  })

  it('updates sizes at a nested path', () => {
    const root: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        {
          type: 'column',
          children: [
            { type: 'panel', panelId: 'p2', panelType: 'chart' },
            { type: 'panel', panelId: 'p3', panelType: 'chart' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.3, 0.7],
    }
    const result = updateSizesAtPath(root, [1], [0.6, 0.4])
    if (result.type === 'row' || result.type === 'column') {
      const nested = result.children[1]
      if (nested.type === 'row' || nested.type === 'column') {
        expect(nested.sizes[0]).toBeCloseTo(0.6)
        expect(nested.sizes[1]).toBeCloseTo(0.4)
      }
    }
  })

  it('returns panel node unchanged', () => {
    const root: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    expect(updateSizesAtPath(root, [], [0.5, 0.5])).toEqual(root)
  })
})
```

- [ ] **Step 18: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: FAIL — findPanelNode and updateSizesAtPath not exported

- [ ] **Step 19: Implement `findPanelNode` and `updateSizesAtPath`**

Add to `src/panel-system/layoutUtils.ts`:

```ts
export function findPanelNode(
  node: LayoutNode,
  panelId: string,
): Extract<LayoutNode, { type: 'panel' }> | undefined {
  if (node.type === 'panel') {
    return node.panelId === panelId ? node : undefined
  }
  for (const child of node.children) {
    const found = findPanelNode(child, panelId)
    if (found) return found
  }
  return undefined
}

export function updateSizesAtPath(node: LayoutNode, path: number[], sizes: number[]): LayoutNode {
  if (node.type === 'panel') return node

  if (path.length === 0) {
    return { ...node, sizes: normalizeSizes(sizes) }
  }

  const [head, ...rest] = path
  const children = [...node.children]
  children[head] = updateSizesAtPath(children[head], rest, sizes)
  return { ...node, children }
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/layoutUtils.test.ts`
Expected: PASS

- [ ] **Step 21: Commit**

```bash
git add src/panel-system/layoutUtils.ts src/__tests__/panel-system/layoutUtils.test.ts
git commit -m "add layout tree utility functions with tests"
```

---

### Task 2: Layout Store (Zustand)

**Files:**
- Create: `src/stores/layoutStore.ts`
- Test: `src/__tests__/stores/layoutStore.test.ts`

- [ ] **Step 1: Write failing tests for default layout and basic selectors**

```ts
// src/__tests__/stores/layoutStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore, DEFAULT_LAYOUT } from '../../stores/layoutStore'

describe('layoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({ layout: DEFAULT_LAYOUT, linkGroups: [] }, true)
    localStorage.clear()
  })

  it('has a default layout with watchlist and chart', () => {
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('row')
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.children).toHaveLength(2)
      expect(layout.sizes).toEqual([0.3, 0.7])
      const left = layout.children[0]
      const right = layout.children[1]
      expect(left.type).toBe('panel')
      expect(right.type).toBe('panel')
      if (left.type === 'panel') {
        expect(left.panelType).toBe('watchlist')
        expect(left.linkColor).toBe('amber')
      }
      if (right.type === 'panel') {
        expect(right.panelType).toBe('chart')
        expect(right.linkColor).toBe('amber')
      }
    }
  })

  it('has default link groups as empty array', () => {
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement initial store with default layout**

```ts
// src/stores/layoutStore.ts
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

export const useLayoutStore = create<LayoutState>()((set) => ({
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
    const { layout, linkGroups } = useLayoutStore.getState()
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

// Selector for getting linked symbol reactively — use in components:
// const symbol = useLayoutStore(selectLinkedSymbol('amber'))
export function selectLinkedSymbol(color: LinkColor) {
  return (state: LayoutState) =>
    state.linkGroups.find((g) => g.color === color)?.activeSymbol ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `removePanel` action**

Add to test file:

```ts
  it('removePanel removes a panel and collapses single child', () => {
    const { removePanel } = useLayoutStore.getState()
    removePanel('panel-default-watchlist')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('panel')
    if (layout.type === 'panel') {
      expect(layout.panelType).toBe('chart')
    }
  })

  it('removePanel does not remove the last panel', () => {
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'p1', panelType: 'chart' },
    })
    const { removePanel } = useLayoutStore.getState()
    removePanel('p1')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('panel')
    if (layout.type === 'panel') expect(layout.panelId).toBe('p1')
  })
```

- [ ] **Step 6: Run test to verify it passes** (already implemented in Step 3)

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 7: Write failing tests for `addPanel` action**

Add to test file:

```ts
  it('addPanel splits the rightmost panel', () => {
    const { addPanel } = useLayoutStore.getState()
    addPanel('chart')
    const { layout } = useLayoutStore.getState()
    expect(layout.type).toBe('row')
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.children[0].type).toBe('panel')
      expect(layout.children[1].type).toBe('row')
    }
  })
```

- [ ] **Step 8: Run test to verify it passes** (already implemented in Step 3)

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing tests for `resizePanel` action**

Add to test file:

```ts
  it('resizePanel updates sizes at root path', () => {
    const { resizePanel } = useLayoutStore.getState()
    resizePanel([], [0.4, 0.6])
    const { layout } = useLayoutStore.getState()
    if (layout.type === 'row' || layout.type === 'column') {
      expect(layout.sizes[0]).toBeCloseTo(0.4)
      expect(layout.sizes[1]).toBeCloseTo(0.6)
    }
  })
```

- [ ] **Step 10: Run test to verify it passes** (already implemented in Step 3)

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 11: Write failing tests for link group actions**

Add to test file:

```ts
  it('broadcastSymbol creates a link group lazily', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('amber', 'BTC/USDT')
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toEqual([{ color: 'amber', activeSymbol: 'BTC/USDT' }])
  })

  it('broadcastSymbol updates existing link group', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('amber', 'BTC/USDT')
    broadcastSymbol('amber', 'ETH/USDT')
    const { linkGroups } = useLayoutStore.getState()
    expect(linkGroups).toHaveLength(1)
    expect(linkGroups[0]).toEqual({ color: 'amber', activeSymbol: 'ETH/USDT' })
  })

  it('selectLinkedSymbol returns the active symbol for a color', () => {
    const { broadcastSymbol } = useLayoutStore.getState()
    broadcastSymbol('green', 'SOL/USDT')
    const result = selectLinkedSymbol('green')(useLayoutStore.getState())
    expect(result).toBe('SOL/USDT')
  })

  it('selectLinkedSymbol returns null for unknown color', () => {
    const result = selectLinkedSymbol('blue')(useLayoutStore.getState())
    expect(result).toBeNull()
  })
```

Add to the import at the top of the test file:

```ts
import { useLayoutStore, DEFAULT_LAYOUT, selectLinkedSymbol } from '../../stores/layoutStore'
```

- [ ] **Step 12: Run test to verify it passes** (already implemented in Step 3)

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 13: Write failing tests for localStorage persistence**

Add to test file:

```ts
  it('saveLayout persists to localStorage', () => {
    const { saveLayout } = useLayoutStore.getState()
    saveLayout()
    const stored = localStorage.getItem('terminal-layout')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.layout.type).toBe('row')
    expect(parsed.linkGroups).toEqual([])
  })

  it('loadLayout restores from localStorage', () => {
    const custom: LayoutNode = { type: 'panel', panelId: 'custom', panelType: 'chart' }
    localStorage.setItem(
      'terminal-layout',
      JSON.stringify({ layout: custom, linkGroups: [{ color: 'amber', activeSymbol: 'ETH/USDT' }] }),
    )
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout, linkGroups } = useLayoutStore.getState()
    expect(layout).toEqual(custom)
    expect(linkGroups).toEqual([{ color: 'amber', activeSymbol: 'ETH/USDT' }])
  })

  it('loadLayout falls back to default on invalid JSON', () => {
    // First mutate state away from default
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'mutated', panelType: 'chart' },
    })
    localStorage.setItem('terminal-layout', 'not json')
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout } = useLayoutStore.getState()
    // Must reset to default, not keep mutated state
    expect(layout).toEqual(DEFAULT_LAYOUT)
  })

  it('loadLayout falls back to default on missing key', () => {
    // First mutate state away from default
    useLayoutStore.setState({
      layout: { type: 'panel', panelId: 'mutated', panelType: 'chart' },
    })
    const { loadLayout } = useLayoutStore.getState()
    loadLayout()
    const { layout } = useLayoutStore.getState()
    expect(layout).toEqual(DEFAULT_LAYOUT)
  })
```

Add `LayoutNode` to the import:

```ts
import type { LayoutNode } from '../../types'
```

- [ ] **Step 14: Run test to verify it passes** (already implemented in Step 3)

Run: `npx vitest run src/__tests__/stores/layoutStore.test.ts`
Expected: PASS

- [ ] **Step 15: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 16: Commit**

```bash
git add src/stores/layoutStore.ts src/__tests__/stores/layoutStore.test.ts
git commit -m "add layout store with mutations and persistence"
```

---

## Chunk 2: Panel Registry, PanelShell, Splitter, PanelGrid, App Integration

### Task 3: Panel Registry

**Files:**
- Create: `src/panel-system/registry.ts`
- Test: `src/__tests__/panel-system/registry.test.ts`

- [ ] **Step 1: Write failing tests for registry**

```ts
// src/__tests__/panel-system/registry.test.ts
import { describe, it, expect } from 'vitest'
import { registerPanel, getPanel } from '../../panel-system/registry'
import type { PanelProps } from '../../types'

function MockPanel(_props: PanelProps) {
  return null
}

describe('panel registry', () => {
  it('getPanel returns the registered component', () => {
    registerPanel('chart', MockPanel)
    expect(getPanel('chart')).toBe(MockPanel)
  })

  it('getPanel returns undefined for unknown types', () => {
    expect(getPanel('watchlist')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement panel registry**

```ts
// src/panel-system/registry.ts
import type { ComponentType } from 'react'
import type { PanelProps, PanelType } from '../types'

const registry = new Map<PanelType, ComponentType<PanelProps>>()

export function registerPanel(type: PanelType, component: ComponentType<PanelProps>): void {
  registry.set(type, component)
}

export function getPanel(type: PanelType): ComponentType<PanelProps> | undefined {
  return registry.get(type)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Create placeholder panel components**

```tsx
// src/panels/watchlist/WatchlistPanel.tsx
import type { PanelProps } from '../../types'

export function WatchlistPanel({ panelId, linkedSymbol }: PanelProps) {
  return <div data-testid={`watchlist-${panelId}`}>Watchlist {linkedSymbol ?? 'unlinked'}</div>
}
```

```tsx
// src/panels/chart/ChartPanel.tsx
import type { PanelProps } from '../../types'

export function ChartPanel({ panelId, linkedSymbol }: PanelProps) {
  return <div data-testid={`chart-${panelId}`}>Chart {linkedSymbol ?? 'BTC/USDT'}</div>
}
```

- [ ] **Step 6: Commit**

```bash
git add src/panel-system/registry.ts src/__tests__/panel-system/registry.test.ts src/panels/watchlist/WatchlistPanel.tsx src/panels/chart/ChartPanel.tsx
git commit -m "add panel registry and placeholder panels"
```

---

### Task 4: Splitter Component

**Files:**
- Create: `src/panel-system/Splitter.tsx`
- Test: `src/__tests__/panel-system/Splitter.test.tsx`

- [ ] **Step 1: Write failing test for Splitter rendering and drag**

```tsx
// src/__tests__/panel-system/Splitter.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Splitter } from '../../panel-system/Splitter'

describe('Splitter', () => {
  it('renders a draggable divider', () => {
    render(<Splitter direction="row" onResize={vi.fn()} />)
    expect(screen.getByRole('separator')).toBeDefined()
  })

  it('applies data-direction for row', () => {
    render(<Splitter direction="row" onResize={vi.fn()} />)
    expect(screen.getByRole('separator').dataset.direction).toBe('row')
  })

  it('applies data-direction for column', () => {
    render(<Splitter direction="column" onResize={vi.fn()} />)
    expect(screen.getByRole('separator').dataset.direction).toBe('column')
  })

  it('calls onResize with delta on drag (row = X axis)', () => {
    const onResize = vi.fn()
    render(<Splitter direction="row" onResize={onResize} />)
    const sep = screen.getByRole('separator')

    fireEvent.mouseDown(sep, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(document, { clientX: 120, clientY: 100 })
    fireEvent.mouseUp(document)

    expect(onResize).toHaveBeenCalledWith(20)
  })

  it('calls onResize with delta on drag (column = Y axis)', () => {
    const onResize = vi.fn()
    render(<Splitter direction="column" onResize={onResize} />)
    const sep = screen.getByRole('separator')

    fireEvent.mouseDown(sep, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(document, { clientX: 100, clientY: 130 })
    fireEvent.mouseUp(document)

    expect(onResize).toHaveBeenCalledWith(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/Splitter.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Splitter**

```tsx
// src/panel-system/Splitter.tsx
import { useCallback, useRef } from 'react'

type SplitterProps = {
  direction: 'row' | 'column'
  onResize: (deltaPx: number) => void
}

export function Splitter({ direction, onResize }: SplitterProps) {
  const startPos = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startPos.current = direction === 'row' ? e.clientX : e.clientY

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const current = direction === 'row' ? moveEvent.clientX : moveEvent.clientY
        const delta = current - startPos.current
        if (delta !== 0) {
          onResize(delta)
          startPos.current = current
        }
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [direction, onResize],
  )

  return (
    <div
      role="separator"
      data-direction={direction}
      onMouseDown={handleMouseDown}
      style={{
        flexShrink: 0,
        cursor: direction === 'row' ? 'col-resize' : 'row-resize',
        width: direction === 'row' ? 4 : '100%',
        height: direction === 'column' ? 4 : '100%',
      }}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/Splitter.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/panel-system/Splitter.tsx src/__tests__/panel-system/Splitter.test.tsx
git commit -m "add Splitter component with drag-resize"
```

---

### Task 5: PanelShell Component

**Files:**
- Create: `src/panel-system/PanelShell.tsx`
- Test: `src/__tests__/panel-system/PanelShell.test.tsx`

- [ ] **Step 1: Write failing tests for PanelShell**

```tsx
// src/__tests__/panel-system/PanelShell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelShell } from '../../panel-system/PanelShell'
import { registerPanel } from '../../panel-system/registry'
import type { PanelProps } from '../../types'

function MockPanel({ panelId }: PanelProps) {
  return <div data-testid={`mock-${panelId}`}>Mock Panel</div>
}

describe('PanelShell', () => {
  beforeEach(() => {
    registerPanel('chart', MockPanel)
  })

  it('renders the registered panel component', () => {
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={vi.fn()} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    expect(screen.getByTestId('mock-p1')).toBeDefined()
  })

  it('displays panel type in title bar', () => {
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={vi.fn()} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    expect(screen.getByText('CHART')).toBeDefined()
  })

  it('displays panel type with linked symbol in title bar', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkColor="amber"
        linkedSymbol="BTC/USDT"
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('CHART BTC/USDT')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <PanelShell panelId="p1" panelType="chart" onClose={onClose} linkedSymbol={null} onSymbolSelect={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledWith('p1')
  })

  it('hides close button when isLastPanel is true', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkedSymbol={null}
        onSymbolSelect={vi.fn()}
        isLastPanel
      />,
    )
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  it('shows link color indicator when linkColor is provided', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="chart"
        onClose={vi.fn()}
        linkColor="amber"
        linkedSymbol="BTC/USDT"
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('link-indicator')).toBeDefined()
  })

  it('renders fallback for unregistered panel type', () => {
    render(
      <PanelShell
        panelId="p1"
        panelType="watchlist"
        onClose={vi.fn()}
        linkedSymbol={null}
        onSymbolSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(/unknown panel/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/PanelShell.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PanelShell**

```tsx
// src/panel-system/PanelShell.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/PanelShell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/panel-system/PanelShell.tsx src/__tests__/panel-system/PanelShell.test.tsx
git commit -m "add PanelShell with title bar and close button"
```

---

### Task 6: PanelGrid Component

**Files:**
- Create: `src/panel-system/PanelGrid.tsx`
- Test: `src/__tests__/panel-system/PanelGrid.test.tsx`

- [ ] **Step 1: Write failing tests for PanelGrid rendering**

```tsx
// src/__tests__/panel-system/PanelGrid.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelGrid } from '../../panel-system/PanelGrid'
import { registerPanel } from '../../panel-system/registry'
import type { LayoutNode, PanelProps } from '../../types'

function MockChart({ panelId }: PanelProps) {
  return <div data-testid={`chart-${panelId}`}>Chart</div>
}

function MockWatchlist({ panelId }: PanelProps) {
  return <div data-testid={`watchlist-${panelId}`}>Watchlist</div>
}

describe('PanelGrid', () => {
  beforeEach(() => {
    registerPanel('chart', MockChart)
    registerPanel('watchlist', MockWatchlist)
  })

  it('renders a single panel', () => {
    const layout: LayoutNode = { type: 'panel', panelId: 'p1', panelType: 'chart' }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel
      />,
    )
    expect(screen.getByTestId('chart-p1')).toBeDefined()
  })

  it('renders a row with two panels and a splitter', () => {
    const layout: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        { type: 'panel', panelId: 'p2', panelType: 'chart' },
      ],
      sizes: [0.3, 0.7],
    }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel={false}
      />,
    )
    expect(screen.getByTestId('watchlist-p1')).toBeDefined()
    expect(screen.getByTestId('chart-p2')).toBeDefined()
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('renders a 3-level nested layout (row > column > 2 panels)', () => {
    const layout: LayoutNode = {
      type: 'row',
      children: [
        { type: 'panel', panelId: 'p1', panelType: 'watchlist' },
        {
          type: 'column',
          children: [
            { type: 'panel', panelId: 'p2', panelType: 'chart' },
            { type: 'panel', panelId: 'p3', panelType: 'chart' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.3, 0.7],
    }
    render(
      <PanelGrid
        layout={layout}
        onClose={vi.fn()}
        onResize={vi.fn()}
        getLinkedSymbol={() => null}
        onSymbolSelect={vi.fn()}
        isOnlyPanel={false}
      />,
    )
    expect(screen.getByTestId('watchlist-p1')).toBeDefined()
    expect(screen.getByTestId('chart-p2')).toBeDefined()
    expect(screen.getByTestId('chart-p3')).toBeDefined()
    // 1 splitter between row children + 1 between column children = 2
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panel-system/PanelGrid.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PanelGrid**

```tsx
// src/panel-system/PanelGrid.tsx
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
  // isOnlyPanel for children: the entire tree has only one panel left
  // when inside a split node, totalPanels >= 2, so children are never "the only panel"
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

      // Clamp to minimum panel size (120px width, 80px height)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/panel-system/PanelGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/panel-system/PanelGrid.tsx src/__tests__/panel-system/PanelGrid.test.tsx
git commit -m "add PanelGrid recursive layout renderer"
```

---

### Task 7: App Integration

**Files:**
- Create: `src/panel-system/index.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create barrel export for panel-system**

```ts
// src/panel-system/index.ts
export { PanelGrid } from './PanelGrid'
export { PanelShell } from './PanelShell'
export { Splitter } from './Splitter'
export { registerPanel, getPanel } from './registry'
```

- [ ] **Step 2: Wire up App.tsx to render PanelGrid from the layout store**

```tsx
// src/App.tsx
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
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Verify the app compiles**

Run: `npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/panel-system/index.ts
git commit -m "wire PanelGrid into App with layout store"
```

- [ ] **Step 6: Run the app and visually verify**

Run: `npx vite --open`
Expected: Browser opens showing a split layout with "Watchlist" on the left (30%) and "Chart" on the right (70%), with draggable splitter between them. Close buttons visible on panel title bars. Closing one panel leaves the other full-width with no close button.
