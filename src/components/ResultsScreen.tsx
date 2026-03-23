import { useEffect, useRef, useState } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import type { GameState, GameRound } from "../types"
import { generateShareText, MEDAL_EMOJIS } from "../lib/share"
import { getDayNumber } from "../lib/scoring"

// Fix Leaflet default icon issue with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" })

function makeNumberedIcon(n: number, fill: string, textColor: string) {
  return L.divIcon({
    html: `<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="${fill}"/>
      <circle cx="12" cy="12" r="7" fill="white"/>
      <text x="12" y="16" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold" fill="${textColor}">${n}</text>
    </svg>`,
    className: "",
    iconSize: [24, 36],
    iconAnchor: [12, 36],
  })
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface ResultsScreenProps {
  gameState: GameState
  onPlayAgain: () => void
}

// ─── Map: auto-fit bounds to all markers ───────────────────────────────────

function BoundsFitter({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })
    fitted.current = true
  }, [map, positions])

  return null
}

// ─── Countdown to midnight UTC ─────────────────────────────────────────────

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => getMsUntilMidnightUTC())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getMsUntilMidnightUTC())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return timeLeft
}

function getMsUntilMidnightUTC(): number {
  const now = new Date()
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  )
  return Math.max(0, tomorrow.getTime() - now.getTime())
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Per-object card ───────────────────────────────────────────────────────

function RoundCard({ round }: { round: GameRound }) {
  const medalEmoji = round.medal ? MEDAL_EMOJIS[round.medal] : "⬜"
  const score = round.score ?? 0
  const isUnavailable = round.metData === null
  const metUrl = `https://www.metmuseum.org/art/collection/search/${round.seed.objectID}`

  return (
    <div
      className="flex items-center gap-3 bg-parchment border border-sepia rounded p-3"
      style={{
        boxShadow: "0 1px 4px rgba(44,36,22,0.08), 0 0 0 1px rgba(212,197,169,0.3)",
      }}
    >
      {/* Thumbnail — links to Met page */}
      <a
        href={metUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-sepia bg-cream-dark block"
      >
        {round.metData?.primaryImageSmall ? (
          <img
            src={round.metData.primaryImageSmall}
            alt={round.metData.title}
            className="w-full h-full object-cover hover:opacity-80 transition-opacity"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-sepia-dark text-xs text-center leading-tight px-1">
              {isUnavailable ? "N/A" : "…"}
            </span>
          </div>
        )}
      </a>

      {/* Middle: title + status */}
      <div className="flex-1 min-w-0">
        <a
          href={metUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink text-sm font-medium leading-snug truncate hover:underline block"
          style={{ fontFamily: "'Source Serif 4', serif" }}
          title={round.metData?.title ?? "Unknown object"}
        >
          {round.metData?.title ?? "Object unavailable"}
        </a>
        <p
          className="text-ink-light text-xs mt-0.5"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          {isUnavailable
            ? "Object unavailable"
            : round.timedOut
            ? (
              <span className="text-red-500" style={{ color: "#E63B2E" }}>
                Timed out
              </span>
            )
            : round.distanceKm !== null
            ? (
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {Math.round(round.distanceKm).toLocaleString()} km
              </span>
            )
            : round.metData?.objectDate ?? ""}
        </p>
        {round.metData?.objectDate && !round.timedOut && !isUnavailable && (
          <p
            className="text-sepia-dark text-xs"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            {round.metData.objectDate}
          </p>
        )}
        {/* Hints badge */}
        {round.hintsUsed > 0 && (
          <span
            className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-cream-dark border border-sepia text-ink-light"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            💡 ×{round.hintsUsed}
          </span>
        )}
      </div>

      {/* Right: medal + score */}
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-2xl leading-none">{medalEmoji}</span>
        <span
          className="text-sm font-medium text-ink"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {score.toLocaleString()}
        </span>
        <span
          className="text-xs text-ink-light"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          pts
        </span>
      </div>
    </div>
  )
}

// ─── Overview map ──────────────────────────────────────────────────────────

function OverviewMap({ rounds }: { rounds: GameRound[] }) {
  // Collect all positions for bounds fitting
  const allPositions: [number, number][] = []
  rounds.forEach((r) => {
    allPositions.push([r.seed.lat, r.seed.lng])
    if (r.playerGuess) allPositions.push(r.playerGuess)
  })

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="w-full rounded border border-sepia"
      style={{ height: "300px" }}
      scrollWheelZoom={false}
      attributionControl={true}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      <BoundsFitter positions={allPositions} />

      {rounds.map((round, i) => (
        <MapMarkersForRound key={i} round={round} roundNumber={i + 1} />
      ))}
    </MapContainer>
  )
}

function MapMarkersForRound({ round, roundNumber }: { round: GameRound; roundNumber: number }) {
  const correctPos: [number, number] = [round.seed.lat, round.seed.lng]
  const playerIcon = makeNumberedIcon(roundNumber, "#E63B2E", "#E63B2E")
  const correctIcon = makeNumberedIcon(roundNumber, "#4A7C59", "#4A7C59")

  // Adjust longitude so the line takes the short arc across the antimeridian
  let guessLng = round.playerGuess?.[1] ?? 0
  if (round.playerGuess) {
    const diff = guessLng - correctPos[1]
    if (diff > 180) guessLng -= 360
    else if (diff < -180) guessLng += 360
  }

  return (
    <>
      {/* Correct location — green numbered pin */}
      <Marker position={correctPos} icon={correctIcon} />

      {/* Player guess — red numbered pin (only if placed) */}
      {round.playerGuess && (
        <Marker position={[round.playerGuess[0], guessLng]} icon={playerIcon} />
      )}

      {/* Dashed red line from guess to correct */}
      {round.playerGuess && (
        <Polyline
          positions={[[round.playerGuess[0], guessLng], correctPos]}
          pathOptions={{
            color: "#E63B2E",
            weight: 2,
            dashArray: "5, 7",
            opacity: 0.7,
          }}
        />
      )}
    </>
  )
}

// ─── Main ResultsScreen ────────────────────────────────────────────────────

export function ResultsScreen({ gameState, onPlayAgain }: ResultsScreenProps) {
  const [copied, setCopied] = useState(false)
  const timeLeft = useCountdown()

  const totalScore = gameState.rounds.reduce(
    (sum, r) => sum + (r.score ?? 0),
    0
  )
  const dayNumber = getDayNumber(gameState.date)

  const completedRounds = gameState.rounds.filter(
    (r) => r.distanceKm !== null || r.timedOut
  )
  const avgDistance =
    completedRounds.length > 0
      ? completedRounds.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0) /
        completedRounds.length
      : null

  const bestRound =
    gameState.rounds.reduce<GameRound | null>((best, r) => {
      if (r.score === null) return best
      if (!best || r.score > (best.score ?? 0)) return r
      return best
    }, null)

  const totalHints = gameState.rounds.reduce(
    (sum, r) => sum + r.hintsUsed,
    0
  )

  const shareText = generateShareText(gameState)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in the pre block
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isHighScore = totalScore >= 8000

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* ── Header ── */}
      <div className="border-b border-sepia bg-parchment px-4 py-5">
        <div className="max-w-2xl mx-auto">
          {/* Title row */}
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2
              className="text-ink text-2xl leading-none"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Stolen Antiquities
            </h2>
            <span
              className="text-ink-light text-sm"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              #{dayNumber}
            </span>
          </div>

          {/* Total score */}
          <div className="mt-4">
            <h1
              className="text-5xl md:text-6xl leading-none"
              style={{
                fontFamily: "'DM Serif Display', serif",
                color: isHighScore ? "#C8A951" : "#2C2416",
              }}
            >
              {totalScore.toLocaleString()}
            </h1>
            <p
              className="text-ink-light text-sm mt-1"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              out of 10,000
            </p>
          </div>

          {/* Summary stats */}
          <div
            className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-light"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            {avgDistance !== null && (
              <span>
                Avg distance:{" "}
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(avgDistance).toLocaleString()} km
                </span>
              </span>
            )}
            {bestRound?.metData && (
              <span>
                Best:{" "}
                <span className="text-ink">
                  {bestRound.metData.title.length > 28
                    ? bestRound.metData.title.slice(0, 28) + "…"
                    : bestRound.metData.title}
                </span>
              </span>
            )}
            <span>
              Hints used:{" "}
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {totalHints}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {/* Per-object breakdown */}
          <section>
            <h3
              className="text-ink text-lg mb-3 border-b border-sepia pb-2"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Object Breakdown
            </h3>
            <p
              className="text-ink-light text-sm mb-3 leading-relaxed"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Click any object to explore it in the Met's collection — many include 3D views, curator audio clips, provenance research, and more.
            </p>
            <div className="space-y-2">
              {gameState.rounds.map((round, i) => (
                <RoundCard key={i} round={round} />
              ))}
            </div>
          </section>

          {/* Map overview */}
          <section>
            <h3
              className="text-ink text-lg mb-3 border-b border-sepia pb-2"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Map Overview
            </h3>
            <div className="md:h-96">
              <OverviewMap rounds={gameState.rounds} />
            </div>
            <p
              className="text-xs text-sepia-dark mt-2"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              Green pins: correct locations · Red pins: your guesses
            </p>
          </section>

          {/* Share section */}
          <section>
            <h3
              className="text-ink text-lg mb-3 border-b border-sepia pb-2"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Share Results
            </h3>

            {/* Share button */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="w-full py-3 px-6 rounded text-white text-base font-semibold transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "#E63B2E",
                  fontFamily: "'Source Serif 4', serif",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#B22D23")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#E63B2E")
                }
              >
                Copy to Clipboard
              </button>

              {/* "Copied!" toast */}
              {copied && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded pointer-events-none"
                  style={{
                    backgroundColor: "#4A7C59",
                    animation: "fadeIn 0.15s ease-out",
                  }}
                >
                  <span
                    className="text-white font-semibold text-base"
                    style={{ fontFamily: "'Source Serif 4', serif" }}
                  >
                    Copied!
                  </span>
                </div>
              )}
            </div>

            {/* Share text preview */}
            <pre
              className="mt-3 p-4 rounded border border-sepia bg-parchment text-ink text-sm leading-relaxed overflow-x-auto"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {shareText}
            </pre>
          </section>

          {/* Footer */}
          <section className="pb-8 text-center">
            <div
              className="inline-block border border-sepia rounded px-6 py-4 bg-parchment"
              style={{
                boxShadow: "0 1px 4px rgba(44,36,22,0.08)",
              }}
            >
              <p
                className="text-ink-light text-sm"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                Come back tomorrow for a new set of objects
              </p>
              <p
                className="text-ink text-xl mt-2 tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {formatCountdown(timeLeft)}
              </p>
              <p
                className="text-sepia-dark text-xs mt-1"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                until next game
              </p>
            </div>

            <div className="mt-6">
              <button
                onClick={onPlayAgain}
                className="text-ink-light text-sm underline underline-offset-2 hover:text-ink transition-colors"
                style={{ fontFamily: "'Source Serif 4', serif" }}
              >
                Back to start
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
