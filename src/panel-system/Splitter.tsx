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
