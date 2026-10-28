import React from "react"
import { useGameState } from "./hooks/useGameState"
import { SplashScreen } from "./components/SplashScreen"
import { GameScreen } from "./components/GameScreen"
import { ResultsScreen } from "./components/ResultsScreen"

function App() {
  const {
    gameState,
    appPhase,
    practiceMode,
    loadError,
    initGame,
    submitGuess,
    submitTimeout,
    revealHint,
    nextRound,
    goToResults,
    resetToSplash,
  } = useGameState()

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
  if (!gameState && loadError) {
    return (
      <div key="game-error" style={screenStyle} className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-ink max-w-xs" style={{ fontFamily: "'Source Serif 4', serif" }}>
          {loadError}
        </p>
        <button
          onClick={() => initGame({ practice: practiceMode })}
          className="px-8 py-3 bg-ink text-cream rounded text-sm tracking-wide"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          Try again
        </button>
        <button
          onClick={resetToSplash}
          className="text-ink-light text-sm underline underline-offset-2"
          style={{ fontFamily: "'Source Serif 4', serif" }}
        >
          Back to start
        </button>
      </div>
    )
  }

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
