import { describe, it, expect } from 'vitest'
import {
  normalizeSizes, generatePanelId, removePanelNode,
  addPanelToLayout, findPanelNode, updateSizesAtPath,
} from '../../panel-system/layoutUtils'
import type { LayoutNode } from '../../types'

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
