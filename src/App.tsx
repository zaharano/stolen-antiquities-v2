import React, { useEffect } from "react"
import { useGameState } from "./hooks/useGameState"
import { SplashScreen } from "./components/SplashScreen"
import { GameScreen } from "./components/GameScreen"
import { ResultsScreen } from "./components/ResultsScreen"
import { loadGameState, getTodayDateString } from "./lib/storage"

function App() {
  const {
    gameState,
    appPhase,
    initGame,
    submitGuess,
    submitTimeout,
    revealHint,
    nextRound,
    goToResults,
    resetToSplash,
  } = useGameState()

  // On mount: check localStorage for today's game
  useEffect(() => {
    const dateString = getTodayDateString()
    const existing = loadGameState(dateString)
    if (existing?.completed) {
      // Will be handled by initGame, but we can also just show splash
      // and let the splash screen surface the "already played" state.
      // The useGameState.initGame() handles this on "Begin" click.
    }
    // If there's an in-progress game, we can auto-resume when they click Begin.
    // No auto-start — always show splash first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Shared fade-in style applied to every screen so transitions feel smooth
  const screenStyle: React.CSSProperties = {
    animation: "screenFadeIn 200ms ease-out",
  }

  if (appPhase === "splash") {
    return (
      <div key="splash" style={screenStyle}>
        <SplashScreen
          onBegin={() => initGame()}
          onPractice={() => initGame({ practice: true })}
          onViewResults={goToResults}
        />
      </div>
    )
  }

  if (appPhase === "results") {
    if (!gameState) {
      return (
        <div key="results-loading" style={screenStyle} className="min-h-dvh bg-cream flex items-center justify-center">
          <p className="text-ink-light" style={{ fontFamily: "'Source Serif 4', serif" }}>
            Loading…
          </p>
        </div>
      )
    }
    return (
      <div key="results" style={screenStyle}>
        <ResultsScreen gameState={gameState} onPlayAgain={resetToSplash} />
      </div>
    )
  }

  // playing | reveal
  if (!gameState) {
    return (
      <div key="game-loading" style={screenStyle} className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-sepia border-t-ink-light rounded-full animate-spin" />
        <p className="text-ink-light text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>
          Loading objects…
        </p>
      </div>
    )
  }

  return (
    <div key="game" style={screenStyle} className="contents">
      <GameScreen
        gameState={gameState}
        appPhase={appPhase}
        onSubmitGuess={submitGuess}
        onSubmitTimeout={submitTimeout}
        onRevealHint={revealHint}
        onNextRound={nextRound}
      />
    </div>
  )
}

export default App
