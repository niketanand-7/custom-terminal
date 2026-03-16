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
