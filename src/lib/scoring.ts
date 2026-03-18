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
  const baseScore =
    distanceKm <= 50
      ? 1000
      : Math.round(1000 * Math.exp(-(distanceKm - 50) / 1500))

  const penalized = baseScore - hintsUsed * 150
  return Math.max(0, penalized)
}

type ContinentBox = {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
}

const CONTINENT_BOXES: ContinentBox[] = [
  // Europe
  { latMin: 35, latMax: 71, lngMin: -25, lngMax: 45 },
  // Africa
  { latMin: -35, latMax: 37, lngMin: -18, lngMax: 52 },
  // Asia (East/South/Southeast)
  { latMin: 0, latMax: 77, lngMin: 45, lngMax: 180 },
  // Middle East (part of Asia, overlaps Europe box edge)
  { latMin: 15, latMax: 42, lngMin: 25, lngMax: 65 },
  // Americas
  { latMin: -60, latMax: 85, lngMin: -170, lngMax: -30 },
  // Oceania
  { latMin: -50, latMax: 0, lngMin: 100, lngMax: 180 },
]

function getContinent(lat: number, lng: number): number {
  for (let i = 0; i < CONTINENT_BOXES.length; i++) {
    const box = CONTINENT_BOXES[i]
    if (
      lat >= box.latMin &&
      lat <= box.latMax &&
      lng >= box.lngMin &&
      lng <= box.lngMax
    ) {
      return i
    }
  }
  return -1 // unknown / ocean
}

export function getMedal(
  guessLat: number,
  guessLng: number,
  correctLat: number,
  correctLng: number,
  distanceKm: number,
  timedOut: boolean
): Medal {
  if (timedOut) return "lost"
  if (distanceKm <= 50) return "curator"
  if (distanceKm <= 250) return "close"

  const guessContinent = getContinent(guessLat, guessLng)
  const correctContinent = getContinent(correctLat, correctLng)
  if (
    guessContinent !== -1 &&
    correctContinent !== -1 &&
    guessContinent === correctContinent
  ) {
    return "continent"
  }

  return "lost"
}

const EPOCH = new Date("2026-03-01T00:00:00Z").getTime()

export function getDayNumber(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00Z`).getTime()
  return Math.floor((date - EPOCH) / 86400000)
}
