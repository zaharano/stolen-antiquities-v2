import { describe, expect, it } from "vitest"
import { generateShareText } from "./share"
import type { GameRound, GameState, Medal } from "../types"

function round(score: number, medal: Medal, hintsUsed = 0): GameRound {
  return {
    seed: { objectID: 1, lat: 0, lng: 0, difficulty: "easy" },
    metData: null,
    playerGuess: null,
    distanceKm: null,
    score,
    medal,
    hintsUsed,
    timedOut: medal === "lost",
  }
}

describe("generateShareText", () => {
  it("formats the score, two rows of medals, hints and URL", () => {
    const medals: Medal[] = ["curator", "close", "distant", "lost", "curator"]
    const state: GameState = {
      date: "2026-03-11",
      rounds: [...medals, ...medals].map((m, i) => round(m === "lost" ? 0 : 750, m, i === 0 ? 2 : 0)),
      currentRound: 9,
      phase: "results",
      completed: true,
    }
    expect(generateShareText(state)).toBe(
      [
        "🏛️ Stolen Antiquities #10 — 6,000/10,000",
        "",
        "🏛️🎯🗺️❌🏛️",
        "🏛️🎯🗺️❌🏛️",
        "",
        "⏱️ 2 hints used",
        "stolen-antiquities.com",
      ].join("\n")
    )
  })
})
