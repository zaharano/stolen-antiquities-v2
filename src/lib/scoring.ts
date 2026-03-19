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
  // Full points within 200km, then exponential decay
  // ~600 at 1000km, ~215 at 3000km, still non-zero at 10000km
  const baseScore =
    distanceKm <= 300
      ? 1000
      : Math.round(1000 * Math.exp(-(distanceKm - 300) / 3750))

  const penalized = baseScore - hintsUsed * 75
  return Math.max(0, penalized)
}

export function getMedal(
  distanceKm: number,
  timedOut: boolean
): Medal {
  if (timedOut) return "lost"
  if (distanceKm <= 300) return "curator"
  if (distanceKm <= 1500) return "close"
  return "lost"
}

const EPOCH = new Date("2026-03-01T00:00:00Z").getTime()

export function getDayNumber(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00Z`).getTime()
  return Math.floor((date - EPOCH) / 86400000)
}
