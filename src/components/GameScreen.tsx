import { useEffect, useState } from "react"
import type { GameState } from "../types"
import { ObjectPanel, ObjectPeek } from "./ObjectPanel"
import { MapView } from "./MapView"
import { Timer } from "./Timer"
import { RevealOverlay } from "./RevealOverlay"
import { BottomSheet } from "./BottomSheet"
import type { AppPhase } from "../hooks/useGameState"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { ROUND_SECONDS } from "../lib/round"
import { scoringVersionFor, scoringZones } from "../lib/scoring"

interface GameScreenProps {
  gameState: GameState
  appPhase: AppPhase
  onPlacePin: (lat: number, lng: number) => void
  onSubmitGuess: () => void
  onSubmitTimeout: () => void
  onRevealHint: (index: number) => void
  onNextRound: () => void
}

// Side panel on desktop, and on phones in landscape where a bottom sheet
// would leave no room for the map
const SIDE_PANEL_QUERY = "(min-width: 1024px), (orientation: landscape) and (max-height: 500px)"

export function GameScreen({
  gameState,
  appPhase,
  onPlacePin,
  onSubmitGuess,
  onSubmitTimeout,
  onRevealHint,
  onNextRound,
}: GameScreenProps) {
  const isPlaying = appPhase === "playing"
  const isReveal = appPhase === "reveal"

  // Mobile sheet: open while studying the object, collapsed for the reveal
  const [sheetOpen, setSheetOpen] = useState(isPlaying)
  // Only one layout is mounted, so there is a single Timer and ObjectPanel
  const useSidePanel = useMediaQuery(SIDE_PANEL_QUERY)

  const currentRoundIndex = gameState.currentRound
  const round = gameState.rounds[currentRoundIndex]
  const totalRounds = gameState.rounds.length
  const correctPin: [number, number] = [round.seed.lat, round.seed.lng]
  const zones = scoringZones(round.seed, scoringVersionFor(gameState.date))
  const playerPin = isReveal ? round.playerGuess : (round.pendingGuess ?? null)

  // Stop pull-to-refresh and overscroll bounce while playing
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.overscrollBehavior
    root.style.overscrollBehavior = "none"
    return () => {
      root.style.overscrollBehavior = previous
    }
  }, [])

  // Warm the cache with the next object's image while this round is played
  useEffect(() => {
    const next = gameState.rounds[currentRoundIndex + 1]?.metData?.primaryImageSmall
    if (next) new Image().src = next
  }, [gameState.rounds, currentRoundIndex])

  const handlePinPlace = (lat: number, lng: number) => {
    if (isPlaying) onPlacePin(lat, lng)
  }

  const handleConfirm = () => {
    setSheetOpen(false)
    onSubmitGuess()
  }

  const handleTimeout = () => {
    setSheetOpen(false)
    onSubmitTimeout()
  }

  const handleNextRound = () => {
    setSheetOpen(true)
    onNextRound()
  }

  // Keyed by round so each round gets a fresh Timer
  const timer = (
    <Timer
      key={currentRoundIndex}
      seconds={ROUND_SECONDS}
      startedAt={round.startedAt}
      onExpire={handleTimeout}
      running={isPlaying}
    />
  )

  const panelProps = {
    round,
    roundNumber: currentRoundIndex + 1,
    totalRounds,
    onHintReveal: onRevealHint,
  }

  return (
    <div
      className={`flex h-dvh w-full overflow-hidden bg-parchment ${useSidePanel ? "flex-row" : "flex-col"}`}
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* ── Desktop / landscape: side panel ── */}
      {useSidePanel && (
        <aside className="flex flex-col w-[min(360px,42vw)] shrink-0 border-r border-sepia">
          <div className="border-b border-sepia" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            {timer}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <ObjectPanel key={round.seed.objectID} variant="side" {...panelProps} />
          </div>
        </aside>
      )}

      {/* ── Mobile portrait: HUD bar above the map ── */}
      {!useSidePanel && (
        <header
          className="shrink-0 flex items-center bg-parchment border-b border-sepia"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex-1 min-w-0">{timer}</div>
          <span
            className="pr-4 text-ink-light text-xs tracking-widest"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {currentRoundIndex + 1}/{totalRounds}
          </span>
        </header>
      )}

      {/* ── Map area ── */}
      <main className="relative flex-1 min-h-0 min-w-0">
        <MapView
          playerPin={playerPin}
          correctPin={isReveal ? correctPin : null}
          onPinPlace={handlePinPlace}
          showReveal={isReveal}
          interactive={isPlaying}
          roundKey={currentRoundIndex}
          onUserInteract={() => setSheetOpen(false)}
          zones={zones}
        />

        {/* Confirm button / reveal card, anchored to the bottom of the map
            area — keyed so reveal animations restart each round */}
        <RevealOverlay
          key={`${currentRoundIndex}-${isReveal ? "reveal" : "playing"}`}
          round={round}
          roundNumber={currentRoundIndex + 1}
          totalRounds={totalRounds}
          pendingPin={isPlaying ? (round.pendingGuess ?? null) : null}
          phase={isReveal ? "reveal" : "playing"}
          zones={zones}
          onConfirm={handleConfirm}
          onNext={handleNextRound}
        />
      </main>

      {/* ── Mobile portrait: object sheet below the map ── */}
      {!useSidePanel && (
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} peek={<ObjectPeek round={round} />}>
          <ObjectPanel key={round.seed.objectID} variant="sheet" {...panelProps} />
        </BottomSheet>
      )}
    </div>
  )
}
