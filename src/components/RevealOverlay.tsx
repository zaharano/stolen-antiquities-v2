import { useState, useEffect, useRef } from "react"
import type { GameRound } from "../types"
import { MEDAL_EMOJIS } from "../lib/share"

interface RevealOverlayProps {
  round: GameRound
  roundNumber: number
  totalRounds: number
  /** Pin has been placed but not yet confirmed */
  pendingPin: [number, number] | null
  /** Phase: playing (pre-confirm) or reveal (post-confirm) */
  phase: "playing" | "reveal"
  onConfirm: () => void
  onNext: () => void
}

function formatDistance(km: number | null): string {
  if (km === null) return "—"
  if (km < 1) return "< 1 km"
  if (km >= 1000) return `${(km / 1000).toFixed(1).replace(/\.0$/, "")}k km`
  return `${Math.round(km)} km`
}

const MEDAL_LABELS: Record<string, string> = {
  curator: "Perfect",
  close: "Close",
  distant: "Distant",
  lost: "Lost",
}

/** Animates a counter from 0 to `target` over `duration`ms using ease-out cubic. */
function useCountUp(target: number, duration: number, active: boolean): number {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      setDisplayed(0)
      return
    }
    startRef.current = null

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic: 1 - (1 - progress)^3
      const eased = Math.round(target * (1 - Math.pow(1 - progress, 3)))
      setDisplayed(eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, active])

  return displayed
}

export function RevealOverlay({
  round,
  roundNumber,
  totalRounds,
  pendingPin,
  phase,
  onConfirm,
  onNext,
}: RevealOverlayProps) {
  const [nextVisible, setNextVisible] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)

  const isReveal = phase === "reveal"

  // Delay "next" button appearance after reveal; trigger stats/animation
  useEffect(() => {
    if (isReveal) {
      setNextVisible(false)
      setStatsVisible(false)
      // Small delay so the panel renders first, then animate in stats
      const tStats = setTimeout(() => setStatsVisible(true), 80)
      const tNext = setTimeout(() => setNextVisible(true), 1200)
      return () => {
        clearTimeout(tStats)
        clearTimeout(tNext)
      }
    } else {
      setNextVisible(false)
      setStatsVisible(false)
    }
  }, [isReveal])

  // Animate score counting up
  const animatedScore = useCountUp(round.score ?? 0, 600, statsVisible)

  const isLastRound = roundNumber >= totalRounds

  if (phase === "playing") {
    // Show confirm button only if a pin has been placed
    if (!pendingPin) return null

    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
        <button
          onClick={onConfirm}
          className="px-8 py-3 bg-ink text-cream rounded shadow-lg text-sm tracking-wide transition-transform hover:-translate-y-px hover:shadow-xl active:translate-y-0"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          Confirm Placement
        </button>
      </div>
    )
  }

  // Reveal phase
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto w-[min(360px,calc(100vw-2rem))] animate-[fadeIn_200ms_ease-out]"
    >
      <div className="bg-parchment border border-sepia rounded shadow-xl px-5 py-4">
        {/* Timed out notice */}
        {round.timedOut && (
          <p
            className="text-ink-light text-xs text-center mb-3 uppercase tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Time's up
          </p>
        )}

        {/* Medal + label — pop in with scale animation */}
        {round.medal && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="text-2xl"
              style={{
                display: "inline-block",
                animation: statsVisible ? "medalPop 400ms cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
                transform: statsVisible ? undefined : "scale(0)",
                opacity: statsVisible ? undefined : 0,
              }}
            >
              {MEDAL_EMOJIS[round.medal]}
            </span>
            <span
              className="text-ink text-base"
              style={{
                fontFamily: "'DM Serif Display', serif",
                opacity: statsVisible ? 1 : 0,
                transition: "opacity 300ms ease-out 100ms",
              }}
            >
              {MEDAL_LABELS[round.medal]}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-around border-t border-b border-sepia py-3 mb-4">
          {/* Distance — simple fade */}
          <div
            className="text-center"
            style={{
              opacity: statsVisible ? 1 : 0,
              transition: "opacity 400ms ease-out",
            }}
          >
            <p
              className="text-ink text-xl font-medium"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {round.timedOut ? "—" : formatDistance(round.distanceKm)}
            </p>
            <p className="text-ink-light text-xs mt-0.5">distance</p>
          </div>
          <div className="w-px h-8 bg-sepia" />
          {/* Score — count-up animation */}
          <div className="text-center">
            <p
              className={`text-xl font-medium ${round.score === 1000 ? "text-gold" : "text-ink"}`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {animatedScore}
            </p>
            <p className="text-ink-light text-xs mt-0.5">points</p>
          </div>
          {round.hintsUsed > 0 && (
            <>
              <div className="w-px h-8 bg-sepia" />
              <div
                className="text-center"
                style={{
                  opacity: statsVisible ? 1 : 0,
                  transition: "opacity 400ms ease-out 200ms",
                }}
              >
                <p
                  className="text-ink text-xl font-medium"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {round.hintsUsed}
                </p>
                <p className="text-ink-light text-xs mt-0.5">
                  {round.hintsUsed === 1 ? "hint" : "hints"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Next button */}
        <div
          className={`transition-opacity duration-200 ${nextVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <button
            onClick={onNext}
            className="w-full py-2.5 bg-ink text-cream rounded text-sm tracking-wide transition-transform hover:-translate-y-px hover:shadow-md active:translate-y-0"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            {isLastRound ? "See Results →" : "Next Object →"}
          </button>
        </div>
      </div>
    </div>
  )
}
