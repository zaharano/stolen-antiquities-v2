import { useState } from "react"
import type { GameState } from "../types"
import { ObjectPanel } from "./ObjectPanel"
import { MapView } from "./MapView"
import { Timer } from "./Timer"
import { RevealOverlay } from "./RevealOverlay"
import type { AppPhase } from "../hooks/useGameState"
import { useMediaQuery } from "../hooks/useMediaQuery"

interface GameScreenProps {
  gameState: GameState
  appPhase: AppPhase
  onSubmitGuess: (lat: number, lng: number) => void
  onSubmitTimeout: () => void
  onRevealHint: (index: number) => void
  onNextRound: () => void
}

export function GameScreen({
  gameState,
  appPhase,
  onSubmitGuess,
  onSubmitTimeout,
  onRevealHint,
  onNextRound,
}: GameScreenProps) {
  const [pendingPin, setPendingPin] = useState<[number, number] | null>(null)
  const [mobileExpanded, setMobileExpanded] = useState(true)
  // Matches Tailwind's `lg` breakpoint. Only one layout is mounted so there is
  // a single Timer (one onExpire) and a single ObjectPanel (one image load).
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const currentRoundIndex = gameState.currentRound
  const round = gameState.rounds[currentRoundIndex]

  const isPlaying = appPhase === "playing"
  const isReveal = appPhase === "reveal"

  const correctPin: [number, number] = [round.seed.lat, round.seed.lng]

  const handlePinPlace = (lat: number, lng: number) => {
    if (!isPlaying) return
    setPendingPin([lat, lng])
  }

  const handleConfirm = () => {
    if (!pendingPin) return
    onSubmitGuess(pendingPin[0], pendingPin[1])
  }

  const handleNextRound = () => {
    setPendingPin(null)
    setMobileExpanded(true)
    onNextRound()
  }

  const playerPin = isReveal
    ? (round.playerGuess ?? null)
    : pendingPin

  // Keyed by round so the countdown starts fresh for each object
  const timer = (
    <Timer
      key={currentRoundIndex}
      seconds={30}
      onExpire={onSubmitTimeout}
      running={isPlaying}
    />
  )

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* ── Desktop: left panel ── */}
      {isDesktop && (
        <div className="flex flex-col w-[360px] shrink-0 border-r border-sepia">
          {/* Timer sits at the top of the panel */}
          <div className="border-b border-sepia">{timer}</div>

          {/* Object panel fills remaining height */}
          <div className="flex-1 overflow-hidden">
            <ObjectPanel
              key={round.seed.objectID}
              round={round}
              roundNumber={currentRoundIndex + 1}
              onHintReveal={onRevealHint}
              expanded={true}
            />
          </div>
        </div>
      )}

      {/* ── Map area ── */}
      <div className="relative flex-1">
        <MapView
          playerPin={playerPin}
          correctPin={isReveal ? correctPin : null}
          onPinPlace={handlePinPlace}
          showReveal={isReveal}
          interactive={isPlaying}
          roundKey={gameState.currentRound}
        />

        {/* ── Mobile: timer bar floated over map top ── */}
        {!isDesktop && (
          <div className="absolute top-0 left-0 right-0 z-[1000] bg-parchment/90 backdrop-blur-sm border-b border-sepia">
            {timer}
          </div>
        )}

        {/* RevealOverlay / Confirm button — keyed so reveal animations restart each round */}
        <RevealOverlay
          key={`${currentRoundIndex}-${isReveal ? "reveal" : "playing"}`}
          round={round}
          roundNumber={currentRoundIndex + 1}
          totalRounds={gameState.rounds.length}
          pendingPin={pendingPin}
          phase={isReveal ? "reveal" : "playing"}
          onConfirm={handleConfirm}
          onNext={handleNextRound}
        />
      </div>

      {/* ── Mobile: bottom sheet ── */}
      {!isDesktop && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[900] overflow-hidden bg-parchment border-t border-sepia shadow-2xl"
          style={{
            height: mobileExpanded ? "75dvh" : "96px",
            transition: "height 200ms ease-out",
          }}
        >
          {/* Drag handle — visible pill */}
          <div
            className="flex justify-center items-center pt-3 pb-2 cursor-pointer select-none"
            onClick={() => setMobileExpanded((v) => !v)}
            role="button"
            aria-label={mobileExpanded ? "Collapse object panel" : "Expand object panel"}
          >
            <div
              style={{
                width: "40px",
                height: "4px",
                backgroundColor: "#D4C5A9",
                borderRadius: "9999px",
              }}
            />
          </div>

          <div
            className="overflow-y-auto"
            style={{ height: "calc(100% - 28px)" }}
          >
            <ObjectPanel
              key={round.seed.objectID}
              round={round}
              roundNumber={currentRoundIndex + 1}
              onHintReveal={onRevealHint}
              expanded={mobileExpanded}
              onToggleExpand={() => setMobileExpanded((v) => !v)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
