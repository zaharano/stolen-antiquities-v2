import { describe, expect, it } from "vitest"
import seedList from "../../public/data/seed-objects.json"
import { getDailyObjects } from "./daily-selection"
import type { SeedObject } from "../types"

const seeds = seedList as SeedObject[]
const ids = (date: string) => getDailyObjects(date, seeds).map((s) => s.objectID)

describe("getDailyObjects", () => {
  // Golden outputs. Every player must get the same objects for a given date,
  // so these must only change deliberately: a change to the algorithm or to
  // seed-objects.json changes everyone's game. Version such changes with a
  // cutover date (see AGENTS.md, "Daily determinism").
  it("matches the golden selection for known dates", () => {
    expect(ids("2026-03-01")).toEqual([
      312290, 544319, 503673, 544228, 632, 504210, 544060, 715005, 310652, 503677,
    ])
    expect(ids("2026-10-28")).toEqual([
      503396, 454011, 454015, 543937, 447071, 469959, 451042, 544077, 469858, 544319,
    ])
  })

  it("returns 10 distinct objects", () => {
    const picked = ids("2026-06-15")
    expect(picked).toHaveLength(10)
    expect(new Set(picked).size).toBe(10)
  })

  it("is deterministic and differs between days", () => {
    expect(ids("2026-06-15")).toEqual(ids("2026-06-15"))
    expect(ids("2026-06-15")).not.toEqual(ids("2026-06-16"))
  })

  it("does not mutate the seed list", () => {
    const copy = seeds.map((s) => s.objectID)
    getDailyObjects("2026-06-15", seeds)
    expect(seeds.map((s) => s.objectID)).toEqual(copy)
  })
})
