import { useState, useEffect } from "react"
import { getTodayDateString, hasCompletedToday, getGameHistory } from "../lib/storage"
import { MEDAL_EMOJIS } from "../lib/share"
import type { GameHistoryEntry } from "../types"

interface SplashScreenProps {
  onBegin: () => void
  onPractice: () => void
  onViewResults: () => void
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

function getCountdownToMidnightUTC(): string {
  const now = new Date()
  const midnight = new Date()
  midnight.setUTCHours(24, 0, 0, 0)
  const diffMs = midnight.getTime() - now.getTime()
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  const seconds = Math.floor((diffMs % 60000) / 1000)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function HistoryRow({ entry }: { entry: GameHistoryEntry }) {
  const medals = entry.medals.map((m) => (m ? MEDAL_EMOJIS[m] : "⬜")).join("")
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-sepia last:border-0">
      <div>
        <span
          className="text-xs text-ink-light"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          #{entry.dayNumber} · {formatDate(entry.date)}
        </span>
        <div className="text-sm leading-none mt-0.5" style={{ letterSpacing: "0.05em" }}>
          {medals}
        </div>
      </div>
      <span
        className="text-base font-medium text-ink tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {entry.score.toLocaleString()}
      </span>
    </div>
  )
}

export function SplashScreen({ onBegin, onPractice, onViewResults }: SplashScreenProps) {
  const alreadyPlayed = hasCompletedToday()
  const todayString = getTodayDateString()
  const [countdown, setCountdown] = useState(getCountdownToMidnightUTC())
  const history: GameHistoryEntry[] = getGameHistory()

  useEffect(() => {
    if (!alreadyPlayed) return
    const interval = setInterval(() => {
      setCountdown(getCountdownToMidnightUTC())
    }, 1000)
    return () => clearInterval(interval)
  }, [alreadyPlayed])

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 py-12">
      {/* Decorative rule */}
      <div className="w-24 h-px bg-sepia mb-8" />

      <h1
        className="text-ink text-5xl md:text-7xl text-center leading-tight"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Stolen
        <br />
        Antiquities
      </h1>

      <div className="w-24 h-px bg-sepia mt-8 mb-6" />

      <p
        className="text-ink-light text-base md:text-lg text-center max-w-sm"
        style={{ fontFamily: "'Source Serif 4', serif" }}
      >
        Ten objects taken from their homelands. Ten chances to return them.
      </p>

      <div className="mt-8 text-center">
        <p
          className="text-ink text-lg font-medium"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          {formatDate(todayString)}
        </p>
        <p
          className="text-ink-light text-sm mt-1"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          10 objects to return
        </p>
      </div>

      <div className="mt-10">
        {alreadyPlayed ? (
          <div className="flex flex-col items-center gap-4">
            <p
              className="text-ink-light text-sm text-center"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              You've already played today.
            </p>
            <p
              className="text-ink-light text-sm text-center"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Next game in{" "}
              <span className="text-ink font-medium">{countdown}</span>
            </p>
            <button
              onClick={onViewResults}
              className="mt-2 px-8 py-3 bg-ink text-cream rounded text-sm tracking-wide transition-transform hover:-translate-y-px hover:shadow-md"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              View Results
            </button>
            <button
              onClick={onPractice}
              className="px-8 py-3 bg-transparent border border-sepia text-ink-light rounded text-sm tracking-wide transition-colors hover:border-ink-light hover:text-ink"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Play again
            </button>
            <p
              className="text-sepia-dark text-xs text-center max-w-xs"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Practice mode — results won't be saved
            </p>
          </div>
        ) : (
          <button
            onClick={onBegin}
            className="px-12 py-4 bg-ink text-cream rounded text-base tracking-wide transition-transform hover:-translate-y-px hover:shadow-md active:translate-y-0"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Begin
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-12 w-full max-w-xs">
          <h3
            className="text-ink text-sm text-center mb-3 border-b border-sepia pb-2"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Past Games
          </h3>
          <div className="max-h-52 overflow-y-auto">
            {history.map((entry) => (
              <HistoryRow key={entry.date} entry={entry} />
            ))}
          </div>
        </div>
      )}

      <p
        className="mt-16 text-sepia-dark text-xs text-center"
        style={{ fontFamily: "'Source Serif 4', serif" }}
      >
        Objects sourced from the Metropolitan Museum of Art Open Access collection.
      </p>
    </div>
  )
}
