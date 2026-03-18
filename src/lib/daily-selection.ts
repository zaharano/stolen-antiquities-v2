import type { SeedObject } from "../types"

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashDateString(dateString: string): number {
  return Array.from(dateString).reduce(
    (h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0,
    0
  )
}

export function getDailyObjects(
  dateString: string,
  seedList: SeedObject[]
): SeedObject[] {
  const seed = hashDateString(dateString)
  const rand = mulberry32(seed)

  // Fisher-Yates shuffle on a copy
  const shuffled = [...seedList]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, 10)
}
