import { describe, expect, it } from "vitest"
import { HINT_PENALTY, calculateDistance, calculateScore, getDayNumber, getMedal } from "./scoring"

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
