import type { ComponentType } from 'react'
import type { PanelProps, PanelType } from '../types'

const registry = new Map<PanelType, ComponentType<PanelProps>>()

export function registerPanel(type: PanelType, component: ComponentType<PanelProps>): void {
  registry.set(type, component)
}

export function getPanel(type: PanelType): ComponentType<PanelProps> | undefined {
  return registry.get(type)
}
