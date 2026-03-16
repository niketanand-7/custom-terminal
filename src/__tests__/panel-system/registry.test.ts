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
