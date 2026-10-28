import { useRef, type ReactNode } from "react"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shown instead of `children` while collapsed */
  peek: ReactNode
  children: ReactNode
}

// Vertical travel (px) that counts as a swipe rather than a tap
const SWIPE_THRESHOLD = 24

/**
 * Mobile object sheet. It sits in normal flow under the map (not over it), so
 * the map area simply shrinks while it's open and nothing anchored to the
 * bottom of the map can ever end up underneath it.
 */
export function BottomSheet({ open, onOpenChange, peek, children }: BottomSheetProps) {
  const startY = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (startY.current === null) return
    const dy = e.clientY - startY.current
    startY.current = null
    if (dy <= -SWIPE_THRESHOLD) onOpenChange(true)
    else if (dy >= SWIPE_THRESHOLD) onOpenChange(false)
    else onOpenChange(!open) // tap
  }

  return (
    <section
      className="shrink-0 bg-parchment border-t border-sepia shadow-[0_-4px_16px_rgba(44,36,22,0.12)] flex flex-col"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Object details"
    >
      {/* Handle (and the peek row when collapsed): tap or swipe to toggle */}
      <div
        className="cursor-pointer select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (startY.current = null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpenChange(!open)
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? "Collapse object panel" : "Expand object panel"}
      >
        <div className="flex justify-center items-center h-6">
          <div className="w-10 h-1 rounded-full bg-sepia" />
        </div>
        {!open && peek}
      </div>

      <div
        className="overflow-y-auto overscroll-contain"
        style={{
          maxHeight: open ? "46dvh" : 0,
          transition: "max-height 200ms ease-out",
        }}
        aria-hidden={!open}
        inert={!open}
      >
        {children}
      </div>
    </section>
  )
}
