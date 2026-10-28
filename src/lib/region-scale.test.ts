import { describe, expect, it } from "vitest"
import countries from "world-countries"
import { MAX_SCALE_KM, MIN_SCALE_KM, regionScaleKm } from "./region-scale"

const centroids = countries.filter((c) => c.unMember).map((c) => [c.latlng[0], c.latlng[1]] as const)
const scale = (lat: number, lng: number) => regionScaleKm(lat, lng, centroids)

describe("regionScaleKm", () => {
  it("is tight in crowded Europe and loose in sparse East Asia", () => {
    expect(scale(48.8566, 2.3522)).toBe(MIN_SCALE_KM) // Paris
    expect(scale(39.9042, 116.4074)).toBe(MAX_SCALE_KM) // Beijing
    const isfahan = scale(32.6546, 51.668)
    expect(isfahan).toBeGreaterThan(MIN_SCALE_KM)
    expect(isfahan).toBeLessThan(MAX_SCALE_KM)
  })

  it("rounds to 50 km and stays within bounds", () => {
    for (const [lat, lng] of [[0, 0], [-9, 158], [64, -150], [25.74, 32.6], [6.3, 5.6]]) {
      const s = scale(lat, lng)
      expect(s % 50).toBe(0)
      expect(s).toBeGreaterThanOrEqual(MIN_SCALE_KM)
      expect(s).toBeLessThanOrEqual(MAX_SCALE_KM)
    }
  })

  it("ignores the nearest centre (usually the answer's own country)", () => {
    const near: [number, number][] = [[0, 0], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10]]
    const far: [number, number][] = [[0, 0.1], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10]]
    expect(regionScaleKm(0, 0, near)).toBe(regionScaleKm(0, 0, far))
  })
})
