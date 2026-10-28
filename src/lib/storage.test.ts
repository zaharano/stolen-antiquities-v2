import { beforeEach, describe, expect, it } from "vitest"
import { appendGameToHistory, getGameHistory, loadGameState, saveGameState } from "./storage"
import type { GameState } from "../types"

// Minimal in-memory localStorage for the node test environment
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

function game(date: string, score: number, completed = true): GameState {
  return {
    date,
    rounds: [
      {
        seed: { objectID: 1, lat: 0, lng: 0, difficulty: "easy" },
        metData: null,
        playerGuess: [0, 0],
        distanceKm: 0,
        score,
        medal: "curator",
        hintsUsed: 0,
        timedOut: false,
      },
    ],
    currentRound: 0,
    phase: "results",
    completed,
  }
}

describe("storage", () => {
  beforeEach(() => store.clear())

  it("round-trips game state by date", () => {
    saveGameState(game("2026-05-01", 900))
    expect(loadGameState("2026-05-01")?.rounds[0].score).toBe(900)
    expect(loadGameState("2026-05-02")).toBeNull()
  })

  it("keeps history newest first and replaces same-day entries", () => {
    appendGameToHistory(game("2026-05-01", 100))
    appendGameToHistory(game("2026-05-03", 300))
    appendGameToHistory(game("2026-05-02", 200))
    appendGameToHistory(game("2026-05-01", 150))
    expect(getGameHistory().map((h) => [h.date, h.score])).toEqual([
      ["2026-05-03", 300],
      ["2026-05-02", 200],
      ["2026-05-01", 150],
    ])
  })

  it("ignores incomplete games in history", () => {
    appendGameToHistory(game("2026-05-01", 100, false))
    expect(getGameHistory()).toEqual([])
  })
})
