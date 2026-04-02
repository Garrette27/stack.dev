"use client"

import { useRef, useState, type PointerEvent, type ReactNode } from "react"

type ResizablePaneSplitProps = {
  left: ReactNode
  right: ReactNode
  initialLeftWidthPercent?: number
  minPaneWidthPercent?: number
}

function clampPaneWidth(value: number, minPaneWidthPercent: number) {
  const maxPaneWidthPercent = 100 - minPaneWidthPercent
  return Math.min(Math.max(value, minPaneWidthPercent), maxPaneWidthPercent)
}

/**
 * Keeps two code panes side by side on larger screens and hides the drag math
 * behind a small reusable split view interface.
 */
export function ResizablePaneSplit({
  left,
  right,
  initialLeftWidthPercent = 50,
  minPaneWidthPercent = 28
}: ResizablePaneSplitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [leftWidthPercent, setLeftWidthPercent] = useState(() =>
    clampPaneWidth(initialLeftWidthPercent, minPaneWidthPercent)
  )

  const handleResizeStart = (event: PointerEvent<HTMLButtonElement>) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    event.preventDefault()
    const pointerId = event.pointerId
    event.currentTarget.setPointerCapture(pointerId)

    const updatePaneWidth = (clientX: number) => {
      const bounds = container.getBoundingClientRect()
      const rawPercentage = ((clientX - bounds.left) / bounds.width) * 100
      setLeftWidthPercent(clampPaneWidth(rawPercentage, minPaneWidthPercent))
    }

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      updatePaneWidth(moveEvent.clientX)
    }

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp, { once: true })
  }

  return (
    <>
      <div className="grid gap-px bg-white/10 lg:hidden">
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>

      <div ref={containerRef} className="relative hidden lg:flex">
        <div className="min-w-0 shrink-0" style={{ width: `${leftWidthPercent}%` }}>
          {left}
        </div>

        <button
          type="button"
          aria-label="Resize starter and solution panes"
          onPointerDown={handleResizeStart}
          className="absolute inset-y-0 z-10 hidden w-4 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent lg:flex"
          style={{ left: `${leftWidthPercent}%` }}
        >
          <span className="h-full w-px bg-white/18" />
        </button>

        <div className="min-w-0 shrink-0" style={{ width: `${100 - leftWidthPercent}%` }}>
          {right}
        </div>
      </div>
    </>
  )
}
