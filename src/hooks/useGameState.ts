import { useState, useCallback, useRef } from "react"
import type { GameState, GameRound, SeedObject } from "../types"
import { getDailyObjects } from "../lib/daily-selection"
import { prefetchDailyObjects } from "../lib/met-api"
import { resolveRound } from "../lib/round"
import { scoringVersionFor } from "../lib/scoring"
import { saveGameState, loadGameState, getTodayDateString, appendGameToHistory } from "../lib/storage"

export type AppPhase = "splash" | "playing" | "reveal" | "results"

export interface UseGameStateReturn {
  gameState: GameState | null
  appPhase: AppPhase
  practiceMode: boolean
  /** Set when starting a game failed (seed list or network error); cleared on retry */
  loadError: string | null
  initGame: (opts?: { practice?: boolean }) => Promise<void>
  /** Place or move the unconfirmed pin for the current round */
  placePin: (lat: number, lng: number) => void
  /** Confirm the current round's pending pin */
  submitGuess: () => void
  submitTimeout: () => void
  revealHint: (hintIndex: number) => void
  nextRound: () => void
  goToResults: () => void
  resetToSplash: () => void
}

function withCurrentRound(state: GameState, update: (round: GameRound) => GameRound): GameState {
  const rounds = [...state.rounds]
  rounds[state.currentRound] = update(rounds[state.currentRound])
  return { ...state, rounds }
}

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [appPhase, setAppPhase] = useState<AppPhase>("splash")
  const [practiceMode, setPracticeMode] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const practiceModeRef = useRef(false)
  const loadingRef = useRef(false)
  // Latest state, so actions fired from timers never act on a stale snapshot
  // (e.g. a timeout must see the pin placed after the round started)
  const stateRef = useRef<GameState | null>(null)

  const persist = useCallback((state: GameState) => {
    if (!practiceModeRef.current) saveGameState(state)
  }, [])

  /** Make `state` current: remember it, save it (unless practising), render it */
  const commit = useCallback(
    (state: GameState | null) => {
      stateRef.current = state
      if (state) persist(state)
      setGameState(state)
    },
    [persist]
  )

  const initGame = useCallback(async (opts?: { practice?: boolean }) => {
    // Ignore repeat taps on Begin while a game is already loading
    if (loadingRef.current) return
    const isPractice = opts?.practice ?? false
    practiceModeRef.current = isPractice
    setPracticeMode(isPractice)
    setLoadError(null)

    const dateString = getTodayDateString()

    // In normal mode, check for in-progress or completed game
    if (!isPractice) {
      const existing = loadGameState(dateString)
      if (existing) {
        if (existing.completed) {
          commit(existing)
          setAppPhase("results")
        } else if (existing.phase === "reveal") {
          commit(existing)
          setAppPhase("reveal")
        } else {
          // Games saved before startedAt existed restart the clock on resume
          commit(withCurrentRound(existing, (r) => ({ ...r, startedAt: r.startedAt ?? Date.now() })))
          setAppPhase("playing")
        }
        return
      }
    }

    // Show the loading screen while the seed list and Met objects are fetched
    commit(null)
    setAppPhase("playing")
    loadingRef.current = true

    let dailySeeds: SeedObject[]
    let metObjects: Awaited<ReturnType<typeof prefetchDailyObjects>>
    try {
      // Fetch seed list
      const response = await fetch("/data/seed-objects.json")
      if (!response.ok) {
        throw new Error(`Seed list request failed: ${response.status}`)
      }
      const seedList: SeedObject[] = await response.json()

      // Get today's 10 objects
      dailySeeds = getDailyObjects(dateString, seedList)

      // Prefetch all Met objects in parallel (individual failures become null)
      metObjects = await prefetchDailyObjects(dailySeeds)
    } catch (err) {
      console.error("Failed to start game", err)
      setLoadError("We couldn't load today's objects. Check your connection and try again.")
      return
    } finally {
      loadingRef.current = false
    }

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
    rounds[0].startedAt = Date.now()

    commit({
      date: dateString,
      rounds,
      currentRound: 0,
      phase: "playing",
      completed: false,
    })
    setAppPhase("playing")
  }, [commit])

  const placePin = useCallback(
    (lat: number, lng: number) => {
      const state = stateRef.current
      if (!state || state.phase !== "playing") return
      commit(withCurrentRound(state, (r) => ({ ...r, pendingGuess: [lat, lng] })))
    },
    [commit]
  )

  const resolveCurrentRound = useCallback(
    (guess: [number, number] | null) => {
      const state = stateRef.current
      if (!state || state.phase !== "playing") return
      commit({
        ...withCurrentRound(state, (r) => resolveRound(r, guess, scoringVersionFor(state.date))),
        phase: "reveal",
      })
      setAppPhase("reveal")
    },
    [commit]
  )

  const submitGuess = useCallback(() => {
    const round = stateRef.current?.rounds[stateRef.current.currentRound]
    if (round?.pendingGuess) resolveCurrentRound(round.pendingGuess)
  }, [resolveCurrentRound])

  // A pin left on the map when time runs out still counts
  const submitTimeout = useCallback(() => {
    const round = stateRef.current?.rounds[stateRef.current.currentRound]
    resolveCurrentRound(round?.pendingGuess ?? null)
  }, [resolveCurrentRound])

  const revealHint = useCallback(
    (hintIndex: number) => {
      const state = stateRef.current
      if (!state) return
      // Only update if this hint is being revealed for the first time
      // hintsUsed tracks the count of hints revealed
      if (hintIndex < state.rounds[state.currentRound].hintsUsed) return
      commit(withCurrentRound(state, (r) => ({ ...r, hintsUsed: hintIndex + 1 })))
    },
    [commit]
  )

  const nextRound = useCallback(() => {
    const state = stateRef.current
    if (!state) return
    const nextIndex = state.currentRound + 1

    if (nextIndex >= state.rounds.length) {
      // All rounds done — go to results
      const updatedState: GameState = {
        ...state,
        phase: "results",
        completed: true,
      }
      commit(updatedState)
      if (!practiceModeRef.current) appendGameToHistory(updatedState)
      setAppPhase("results")
    } else {
      commit(
        withCurrentRound({ ...state, currentRound: nextIndex, phase: "playing" }, (r) => ({
          ...r,
          startedAt: Date.now(),
        }))
      )
      setAppPhase("playing")
    }
  }, [commit])

  const goToResults = useCallback(() => {
    if (!stateRef.current) {
      const saved = loadGameState(getTodayDateString())
      if (saved) {
        stateRef.current = saved
        setGameState(saved)
      }
    }
    setAppPhase("results")
  }, [])

  const resetToSplash = useCallback(() => {
    setAppPhase("splash")
    stateRef.current = null
    setGameState(null)
    setLoadError(null)
  }, [])

  return {
    gameState,
    appPhase,
    practiceMode,
    loadError,
    initGame,
    placePin,
    submitGuess,
    submitTimeout,
    revealHint,
    nextRound,
    goToResults,
    resetToSplash,
  }
}
