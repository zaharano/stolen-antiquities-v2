import { useState, useCallback, useRef } from "react"
import type { GameState, GameRound, SeedObject } from "../types"
import { getDailyObjects } from "../lib/daily-selection"
import { prefetchDailyObjects } from "../lib/met-api"
import { calculateDistance, calculateScore, getMedal } from "../lib/scoring"
import { saveGameState, loadGameState, getTodayDateString, appendGameToHistory } from "../lib/storage"

export type AppPhase = "splash" | "playing" | "reveal" | "results"

export interface UseGameStateReturn {
  gameState: GameState | null
  appPhase: AppPhase
  practiceMode: boolean
  initGame: (opts?: { practice?: boolean }) => Promise<void>
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
  const [practiceMode, setPracticeMode] = useState(false)
  const practiceModeRef = useRef(false)

  const persist = useCallback((state: GameState) => {
    if (!practiceModeRef.current) saveGameState(state)
  }, [])

  const initGame = useCallback(async (opts?: { practice?: boolean }) => {
    const isPractice = opts?.practice ?? false
    practiceModeRef.current = isPractice
    setPracticeMode(isPractice)

    const dateString = getTodayDateString()

    // In normal mode, check for in-progress or completed game
    if (!isPractice) {
      const existing = loadGameState(dateString)
      if (existing) {
        setGameState(existing)
        if (existing.completed) {
          setAppPhase("results")
        } else {
          setAppPhase(existing.phase === "reveal" ? "reveal" : "playing")
        }
        return
      }
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

    persist(newState)
    setGameState(newState)
    setAppPhase("playing")
  }, [persist])

  const submitGuess = useCallback(
    (lat: number, lng: number) => {
      if (!gameState) return
      const round = gameState.rounds[gameState.currentRound]
      if (!round) return

      const { lat: correctLat, lng: correctLng } = round.seed
      const distanceKm = calculateDistance(lat, lng, correctLat, correctLng)
      const score = calculateScore(distanceKm, round.hintsUsed)
      const medal = getMedal(distanceKm, score, false)

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

      persist(updatedState)
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
        persist(updatedState)
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
      persist(updatedState)
      if (!practiceModeRef.current) appendGameToHistory(updatedState)
      setGameState(updatedState)
      setAppPhase("results")
    } else {
      const updatedState: GameState = {
        ...gameState,
        currentRound: nextIndex,
        phase: "playing",
      }
      persist(updatedState)
      setGameState(updatedState)
      setAppPhase("playing")
    }
  }, [gameState])

  const goToResults = useCallback(() => {
    if (!gameState) {
      const saved = loadGameState(getTodayDateString())
      if (saved) setGameState(saved)
    }
    setAppPhase("results")
  }, [gameState])

  const resetToSplash = useCallback(() => {
    setAppPhase("splash")
    setGameState(null)
  }, [])

  return {
    gameState,
    appPhase,
    practiceMode,
    initGame,
    submitGuess,
    submitTimeout,
    revealHint,
    nextRound,
    goToResults,
    resetToSplash,
  }
}
