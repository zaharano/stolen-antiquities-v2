import { useState, useEffect } from "react"
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
  curator: "Curator",
  close: "Close",
  continent: "Right Continent",
  lost: "Lost",
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

  // Delay "next" button appearance after reveal
  useEffect(() => {
    if (phase === "reveal") {
      setNextVisible(false)
      const t = setTimeout(() => setNextVisible(true), 1200)
      return () => clearTimeout(t)
    } else {
      setNextVisible(false)
    }
  }, [phase])

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

        {/* Medal + label */}
        {round.medal && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">{MEDAL_EMOJIS[round.medal]}</span>
            <span
              className="text-ink text-base"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {MEDAL_LABELS[round.medal]}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-around border-t border-b border-sepia py-3 mb-4">
          <div className="text-center">
            <p
              className="text-ink text-xl font-medium"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {round.timedOut ? "—" : formatDistance(round.distanceKm)}
            </p>
            <p className="text-ink-light text-xs mt-0.5">distance</p>
          </div>
          <div className="w-px h-8 bg-sepia" />
          <div className="text-center">
            <p
              className={`text-xl font-medium ${round.score === 1000 ? "text-gold" : "text-ink"}`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {round.score ?? 0}
            </p>
            <p className="text-ink-light text-xs mt-0.5">points</p>
          </div>
          {round.hintsUsed > 0 && (
            <>
              <div className="w-px h-8 bg-sepia" />
              <div className="text-center">
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
