import { describe, expect, it } from "vitest"
import { resolveRound } from "./round"
import { HINT_PENALTY } from "./scoring"
import type { GameRound } from "../types"

const base: GameRound = {
  seed: { objectID: 1, lat: 25.7402, lng: 32.6014, difficulty: "easy" }, // Luxor
  metData: null,
  playerGuess: null,
  distanceKm: null,
  score: null,
  medal: null,
  hintsUsed: 0,
  timedOut: false,
  startedAt: 1_000,
  pendingGuess: [25.7, 32.6],
}

describe("resolveRound", () => {
  it("scores a guess and clears the pending pin", () => {
    const r = resolveRound(base, [25.7, 32.6], 1)
    expect(r.playerGuess).toEqual([25.7, 32.6])
    expect(r.pendingGuess).toBeNull()
    expect(r.score).toBe(1000)
    expect(r.medal).toBe("curator")
    expect(r.timedOut).toBe(false)
    expect(r.distanceKm).toBeLessThan(10)
  })

  it("applies the hint penalty", () => {
    expect(resolveRound({ ...base, hintsUsed: 2 }, [25.7, 32.6], 1).score).toBe(1000 - 2 * HINT_PENALTY)
  })

  it("loses the round when there is no guess at all", () => {
    const r = resolveRound(base, null, 2)
    expect(r).toMatchObject({ playerGuess: null, pendingGuess: null, score: 0, medal: "lost", timedOut: true })
  })

  it("uses the seed's scale under v2 rules", () => {
    // ~1000 km from Luxor (Khartoum-ish)
    const guess: [number, number] = [16.9, 32.6]
    const tight = resolveRound({ ...base, seed: { ...base.seed, scaleKm: 700 } }, guess, 2)
    const loose = resolveRound({ ...base, seed: { ...base.seed, scaleKm: 2200 } }, guess, 2)
    expect(loose.score!).toBeGreaterThan(tight.score!)
    expect(loose.medal).toBe("close")
    expect(tight.medal).toBe("distant")
  })

  it("keeps the round's other fields", () => {
    expect(resolveRound(base, [0, 0], 1).startedAt).toBe(1_000)
  })
})
