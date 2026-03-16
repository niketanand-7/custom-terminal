import type { LayoutNode, PanelType, LinkColor } from '../types'

export function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0)
  if (total === 0) return sizes.map(() => 1 / sizes.length)
  return sizes.map(s => s / total)
}

let counter = 0

export function generatePanelId(): string {
  return `panel-${Date.now()}-${counter++}`
}

export function removePanelNode(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.type === 'panel') {
    return node.panelId === panelId ? null : node
  }

  const newChildren: LayoutNode[] = []
  const newSizes: number[] = []
  let changed = false

  for (let i = 0; i < node.children.length; i++) {
    const result = removePanelNode(node.children[i], panelId)
    if (result !== null) {
      newChildren.push(result)
      newSizes.push(node.sizes[i])
      if (result !== node.children[i]) changed = true
    } else {
      changed = true
    }
  }

  if (!changed) return node
  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]

  return { type: node.type, children: newChildren, sizes: normalizeSizes(newSizes) }
}

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
