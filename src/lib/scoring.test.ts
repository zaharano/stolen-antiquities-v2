import { describe, expect, it } from "vitest"
import {
  DEFAULT_SCALE_KM,
  HINT_PENALTY,
  SCORING_V2_START,
  calculateDistance,
  calculateScore,
  calculateScoreV2,
  getDayNumber,
  getMedal,
  getMedalV2,
  scoreGuess,
  scoringVersionFor,
  scoringZones,
} from "./scoring"
import type { SeedObject } from "../types"

describe("calculateDistance", () => {
  it("is zero for the same point", () => {
    expect(calculateDistance(25.74, 32.6, 25.74, 32.6)).toBe(0)
  })

  it("matches known great-circle distances", () => {
    // Paris → London ≈ 344 km
    expect(calculateDistance(48.8566, 2.3522, 51.5074, -0.1278)).toBeCloseTo(344, -1)
    // New York → Tokyo ≈ 10,850 km
    expect(calculateDistance(40.7128, -74.006, 35.6762, 139.6503)).toBeCloseTo(10850, -2)
  })

  it("takes the short way across the antimeridian", () => {
    // Two points 2° of longitude apart either side of 180°
    expect(calculateDistance(0, 179, 0, -179)).toBeCloseTo(222.4, 0)
  })
})

describe("calculateScore", () => {
  it("gives full points within 400 km", () => {
    expect(calculateScore(0, 0)).toBe(1000)
    expect(calculateScore(400, 0)).toBe(1000)
  })

  it("follows the current decay curve", () => {
    // Values documented in AGENTS.md; update both if the curve changes
    expect(calculateScore(600, 0)).toBe(710)
    expect(calculateScore(900, 0)).toBe(408)
    expect(calculateScore(1500, 0)).toBe(112)
    expect(calculateScore(2000, 0)).toBe(29)
  })

  it("reaches zero at 4000 km and stays there", () => {
    expect(calculateScore(4000, 0)).toBe(0)
    expect(calculateScore(15000, 0)).toBe(0)
  })

  it("never increases with distance", () => {
    let previous = Infinity
    for (let d = 0; d <= 5000; d += 50) {
      const score = calculateScore(d, 0)
      expect(score).toBeLessThanOrEqual(previous)
      previous = score
    }
  })

  it("deducts HINT_PENALTY per hint and floors at zero", () => {
    expect(calculateScore(0, 1)).toBe(1000 - HINT_PENALTY)
    expect(calculateScore(0, 2)).toBe(1000 - 2 * HINT_PENALTY)
    expect(calculateScore(3000, 2)).toBe(0)
  })
})

describe("getMedal", () => {
  it("awards by distance band", () => {
    expect(getMedal(100, 1000, false)).toBe("curator")
    expect(getMedal(400, 1000, false)).toBe("curator")
    expect(getMedal(401, 999, false)).toBe("close")
    expect(getMedal(1500, 112, false)).toBe("close")
    expect(getMedal(1501, 111, false)).toBe("distant")
  })

  it("is lost on timeout or zero score", () => {
    expect(getMedal(100, 1000, true)).toBe("lost")
    expect(getMedal(5000, 0, false)).toBe("lost")
  })
})

describe("getDayNumber", () => {
  it("counts days from the 2026-03-01 epoch", () => {
    expect(getDayNumber("2026-03-01")).toBe(0)
    expect(getDayNumber("2026-03-02")).toBe(1)
    expect(getDayNumber("2026-10-28")).toBe(241)
  })
})

describe("scoring v2 (region-scaled)", () => {
  const seed = (scaleKm?: number): SeedObject => ({ objectID: 1, lat: 0, lng: 0, difficulty: "easy", scaleKm })

  it("switches on the game date, not the deploy", () => {
    expect(scoringVersionFor("2026-10-31")).toBe(1)
    expect(scoringVersionFor(SCORING_V2_START)).toBe(2)
    expect(scoringVersionFor("2027-01-01")).toBe(2)
  })

  it("gives full points within a quarter of the scale and nothing beyond three times it", () => {
    expect(calculateScoreV2(175, 0, 700)).toBe(1000)
    expect(calculateScoreV2(176, 0, 700)).toBeLessThan(1000)
    expect(calculateScoreV2(2100, 0, 700)).toBe(0)
    expect(calculateScoreV2(9000, 0, 700)).toBe(0)
  })

  it("is kinder to the same miss in a sparse region than a crowded one", () => {
    // The tuning table in docs/ROADMAP.md (Phase 3); update both together
    expect(calculateScoreV2(1000, 0, 700)).toBe(187) // Paris, Rome
    expect(calculateScoreV2(1000, 0, 1300)).toBe(534) // Isfahan
    expect(calculateScoreV2(1000, 0, 2200)).toBe(793) // Beijing, Kyoto
    expect(calculateScoreV2(500, 0, 700)).toBe(574)
  })

  it("never increases with distance", () => {
    let previous = Infinity
    for (let d = 0; d <= 8000; d += 50) {
      const score = calculateScoreV2(d, 0, 1300)
      expect(score).toBeLessThanOrEqual(previous)
      previous = score
    }
  })

  it("applies the same flat hint penalty", () => {
    expect(calculateScoreV2(0, 2, 700)).toBe(1000 - 2 * HINT_PENALTY)
  })

  it("awards medals relative to the scale", () => {
    expect(getMedalV2(175, 1000, false, 700)).toBe("curator")
    expect(getMedalV2(700, 384, false, 700)).toBe("close")
    expect(getMedalV2(701, 383, false, 700)).toBe("distant")
    expect(getMedalV2(100, 1000, true, 700)).toBe("lost")
    expect(getMedalV2(5000, 0, false, 700)).toBe("lost")
  })

  it("scoreGuess matches v1 exactly before the switch", () => {
    for (const d of [0, 400, 600, 900, 1500, 2000, 5000]) {
      const v1 = calculateScore(d, 1)
      expect(scoreGuess(d, 1, seed(700), 1)).toEqual({ score: v1, medal: getMedal(d, v1, false) })
    }
  })

  it("scoreGuess falls back to the default scale for seeds without one", () => {
    expect(scoreGuess(1000, 0, seed(undefined), 2).score).toBe(calculateScoreV2(1000, 0, DEFAULT_SCALE_KM))
  })

  it("reports the zones drawn on the map", () => {
    expect(scoringZones(seed(700), 1)).toEqual({ fullPointsKm: 400, closeKm: 1500 })
    expect(scoringZones(seed(700), 2)).toEqual({ fullPointsKm: 175, closeKm: 700 })
  })
})
