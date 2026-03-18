import type { GameState } from "../types"

interface ResultsScreenProps {
  gameState: GameState
}

export function ResultsScreen({ gameState }: ResultsScreenProps) {
  const totalScore = gameState.rounds.reduce((sum, r) => sum + (r.score ?? 0), 0)

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center p-8">
      <h1
        className="text-ink text-4xl md:text-5xl text-center"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Results
      </h1>
      <p
        className="text-ink-light mt-4 text-lg"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {totalScore.toLocaleString()} / 10,000
      </p>
      <p
        className="text-sepia-dark text-sm mt-6"
        style={{ fontFamily: "'Source Serif 4', serif" }}
      >
        Full results screen coming in Phase 4.
      </p>
    </div>
  )
}
