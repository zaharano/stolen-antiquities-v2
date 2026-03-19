import { useState, useCallback } from "react"
import type { GameState, GameRound, SeedObject } from "../types"
import { getDailyObjects } from "../lib/daily-selection"
import { prefetchDailyObjects } from "../lib/met-api"
import { calculateDistance, calculateScore, getMedal } from "../lib/scoring"
import { saveGameState, loadGameState, getTodayDateString } from "../lib/storage"

export type AppPhase = "splash" | "playing" | "reveal" | "results"

export interface UseGameStateReturn {
  gameState: GameState | null
  appPhase: AppPhase
  initGame: () => Promise<void>
  submitGuess: (lat: number, lng: number) => void
  submitTimeout: () => void
  revealHint: (hintIndex: number) => void
  nextRound: () => void
  goToResults: () => void
  resetToSplash: () => void
}

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [appPhase, setAppPhase] = useState<AppPhase>("splash")

  const initGame = useCallback(async () => {
    const dateString = getTodayDateString()

    // Check for in-progress or completed game
    const existing = loadGameState(dateString)
    if (existing) {
      setGameState(existing)
      if (existing.completed) {
        setAppPhase("results")
      } else {
        // Resume: if last phase was reveal, stay there; otherwise playing
        setAppPhase(existing.phase === "reveal" ? "reveal" : "playing")
      }
      return
    }

    // Fetch seed list
    const response = await fetch("/data/seed-objects.json")
    const seedList: SeedObject[] = await response.json()

    // Get today's 10 objects
    const dailySeeds = getDailyObjects(dateString, seedList)

    // Prefetch all Met objects in parallel
    const metObjects = await prefetchDailyObjects(dailySeeds)

    // Build initial rounds
    const rounds: GameRound[] = dailySeeds.map((seed, i) => ({
      seed,
      metData: metObjects[i],
      playerGuess: null,
      distanceKm: null,
      score: null,
      medal: null,
      hintsUsed: 0,
      timedOut: false,
    }))

    const newState: GameState = {
      date: dateString,
      rounds,
      currentRound: 0,
      phase: "playing",
      completed: false,
    }

    saveGameState(newState)
    setGameState(newState)
    setAppPhase("playing")
  }, [])

  const submitGuess = useCallback(
    (lat: number, lng: number) => {
      if (!gameState) return
      const round = gameState.rounds[gameState.currentRound]
      if (!round) return

      const { lat: correctLat, lng: correctLng } = round.seed
      const distanceKm = calculateDistance(lat, lng, correctLat, correctLng)
      const score = calculateScore(distanceKm, round.hintsUsed)
      const medal = getMedal(lat, lng, correctLat, correctLng, distanceKm, false)

      const updatedRound: GameRound = {
        ...round,
        playerGuess: [lat, lng],
        distanceKm,
        score,
        medal,
      }

      const updatedRounds = [...gameState.rounds]
      updatedRounds[gameState.currentRound] = updatedRound

      const updatedState: GameState = {
        ...gameState,
        rounds: updatedRounds,
        phase: "reveal",
      }

      saveGameState(updatedState)
      setGameState(updatedState)
      setAppPhase("reveal")
    },
    [gameState]
  )

  const submitTimeout = useCallback(() => {
    if (!gameState) return
    const round = gameState.rounds[gameState.currentRound]
    if (!round) return

    const updatedRound: GameRound = {
      ...round,
      playerGuess: null,
      distanceKm: null,
      score: 0,
      medal: "lost",
      timedOut: true,
    }

    const updatedRounds = [...gameState.rounds]
    updatedRounds[gameState.currentRound] = updatedRound

    const updatedState: GameState = {
      ...gameState,
      rounds: updatedRounds,
      phase: "reveal",
    }

    saveGameState(updatedState)
    setGameState(updatedState)
    setAppPhase("reveal")
  }, [gameState])

  const revealHint = useCallback(
    (hintIndex: number) => {
      if (!gameState) return
      const round = gameState.rounds[gameState.currentRound]
      if (!round) return
      // Only update if this hint is being revealed for the first time
      // hintsUsed tracks the count of hints revealed
      if (hintIndex >= round.hintsUsed) {
        const updatedRound: GameRound = {
          ...round,
          hintsUsed: hintIndex + 1,
        }
        const updatedRounds = [...gameState.rounds]
        updatedRounds[gameState.currentRound] = updatedRound
        const updatedState: GameState = { ...gameState, rounds: updatedRounds }
        saveGameState(updatedState)
        setGameState(updatedState)
      }
    },
    [gameState]
  )

  const nextRound = useCallback(() => {
    if (!gameState) return
    const nextIndex = gameState.currentRound + 1

    if (nextIndex >= gameState.rounds.length) {
      // All rounds done — go to results
      const updatedState: GameState = {
        ...gameState,
        phase: "results",
        completed: true,
      }
      saveGameState(updatedState)
      setGameState(updatedState)
      setAppPhase("results")
    } else {
      const updatedState: GameState = {
        ...gameState,
        currentRound: nextIndex,
        phase: "playing",
      }
      saveGameState(updatedState)
      setGameState(updatedState)
      setAppPhase("playing")
    }
  }, [gameState])

  const goToResults = useCallback(() => {
    setAppPhase("results")
  }, [])

  const resetToSplash = useCallback(() => {
    setAppPhase("splash")
    setGameState(null)
  }, [])

  return {
    gameState,
    appPhase,
    initGame,
    submitGuess,
    submitTimeout,
    revealHint,
    nextRound,
    goToResults,
    resetToSplash,
  }
}
