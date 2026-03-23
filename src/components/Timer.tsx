import { useEffect, useRef, useState } from "react"

interface TimerProps {
  seconds: number
  onExpire: () => void
  running: boolean
}

export function Timer({ seconds, onExpire, running }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiredRef = useRef(false)

  // Reset when running transitions from false to true (new round)
  useEffect(() => {
    if (running) {
      setRemaining(seconds)
      expiredRef.current = false
      startTimeRef.current = Date.now()

      intervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const left = Math.max(0, seconds - elapsed)
        setRemaining(left)

        if (left <= 0 && !expiredRef.current) {
          expiredRef.current = true
          if (intervalRef.current) clearInterval(intervalRef.current)
          onExpire()
        }
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Handle tab backgrounding: when the tab becomes visible again, check if
  // time has already elapsed (browsers throttle setInterval in background tabs)
  useEffect(() => {
    if (!running) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && startTimeRef.current && !expiredRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        if (elapsed >= seconds) {
          expiredRef.current = true
          if (intervalRef.current) clearInterval(intervalRef.current)
          setRemaining(0)
          onExpire()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const displaySeconds = Math.ceil(remaining)
  const fraction = remaining / seconds

  let barColor = "bg-ink-light"
  let pulseClass = ""
  if (remaining <= 5) {
    barColor = "bg-red"
    pulseClass = "animate-pulse"
  } else if (remaining <= 10) {
    barColor = "bg-amber"
    pulseClass = "animate-pulse"
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* Numeric display */}
      <span
        className={`text-sm w-6 text-right shrink-0 ${remaining <= 5 ? "text-red" : remaining <= 10 ? "text-amber" : "text-ink-light"}`}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        aria-live="polite"
        aria-label={`${displaySeconds} seconds remaining`}
      >
        {displaySeconds}
      </span>

      {/* Bar */}
      <div className="flex-1 h-1.5 bg-sepia rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor} ${pulseClass}`}
          style={{
            width: `${fraction * 100}%`,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  )
}
