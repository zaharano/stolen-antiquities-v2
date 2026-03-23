import type { Medal } from "../types"

const EARTH_RADIUS_KM = 6371

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function calculateScore(
  distanceKm: number,
  hintsUsed: number
): number {
  // Full points within 400km, then steep decay terminating at 4000km
  // p=6: ~710 at 600km, ~408 at 900km, ~112 at 1500km, ~30 at 2000km, 0 at 4000km
  const t = Math.min(1, (distanceKm - 400) / 3600)
  const baseScore =
    distanceKm <= 400
      ? 1000
      : Math.max(0, Math.round(1000 * Math.pow(1 - t, 6)))

  const penalized = baseScore - hintsUsed * 75
  return Math.max(0, penalized)
}

export function getMedal(
  distanceKm: number,
  score: number,
  timedOut: boolean
): Medal {
  if (timedOut || score === 0) return "lost"
  if (distanceKm <= 400) return "curator"
  if (distanceKm <= 1500) return "close"
  return "distant"
}

const EPOCH = new Date("2026-03-01T00:00:00Z").getTime()

export function getDayNumber(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00Z`).getTime()
  return Math.floor((date - EPOCH) / 86400000)
}
