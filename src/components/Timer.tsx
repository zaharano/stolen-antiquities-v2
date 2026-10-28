import { useEffect, useRef, useState } from "react"

interface TimerProps {
  seconds: number
  /** Epoch ms the round started. Remaining time is derived from this, so a
   *  reload or a backgrounded tab picks up where the clock really is.
   *  Falls back to mount time (older saved games don't have it). */
  startedAt?: number
  onExpire: () => void
  running: boolean
}

export function Timer({ seconds, startedAt: startedAtProp, onExpire, running }: TimerProps) {
  const [mountedAt] = useState(() => Date.now())
  const startedAt = startedAtProp ?? mountedAt
  const [now, setNow] = useState(mountedAt)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  })

  // Tick while running. The parent keys this component by round, so each
  // round mounts a fresh Timer (and a fresh expiredRef).
  useEffect(() => {
    if (!running) return

    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (!expiredRef.current && (t - startedAt) / 1000 >= seconds) {
        expiredRef.current = true
        onExpireRef.current()
      }
    }

    // Browsers throttle intervals in background tabs; re-check on return
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") tick()
    }

    const interval = setInterval(tick, 100)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [running, startedAt, seconds])

  const remaining = Math.min(seconds, Math.max(0, seconds - (now - startedAt) / 1000))
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
