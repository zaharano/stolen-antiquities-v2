import type { Medal, SeedObject } from "../types"

const EARTH_RADIUS_KM = 6371

/** Points deducted from an object's score for each hint revealed. */
export const HINT_PENALTY = 75

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

/** v1 score: the same curve everywhere. Used for game dates before SCORING_V2_START. */
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

  const penalized = baseScore - hintsUsed * HINT_PENALTY
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

// ─── Scoring v2: scaled to the region ───────────────────────────────────────
//
// v1 (above) uses one curve everywhere. v2 scales the curve per object by
// seed.scaleKm, which the seed pipeline derives from how crowded the answer's
// neighbourhood is with other countries (see region-scale.ts). A 1000 km miss
// is a decent guess in East Asia and a different country in Europe.
//
// Every player on a given day must be scored by the same rules, so the switch
// happens by game date, not by deploy.

export type ScoringVersion = 1 | 2

/** First UTC game date scored with v2. */
export const SCORING_V2_START = "2026-11-01"

export function scoringVersionFor(date: string): ScoringVersion {
  return date >= SCORING_V2_START ? 2 : 1
}

/** Used when a seed has no scaleKm (seed lists from before v2). */
export const DEFAULT_SCALE_KM = 1600

// Distances as fractions of the object's scale
const FULL_POINTS_RATIO = 0.25 // full points inside this
const CLOSE_RATIO = 1 // "close" medal inside this (scores ~384+)
const ZERO_POINTS_RATIO = 3 // nothing beyond this

export function calculateScoreV2(distanceKm: number, hintsUsed: number, scaleKm: number): number {
  const x = distanceKm / scaleKm
  const t = Math.min(1, Math.max(0, (x - FULL_POINTS_RATIO) / (ZERO_POINTS_RATIO - FULL_POINTS_RATIO)))
  const baseScore = Math.round(1000 * Math.pow(1 - t, 3))
  return Math.max(0, baseScore - hintsUsed * HINT_PENALTY)
}

export function getMedalV2(distanceKm: number, score: number, timedOut: boolean, scaleKm: number): Medal {
  if (timedOut || score === 0) return "lost"
  if (distanceKm <= FULL_POINTS_RATIO * scaleKm) return "curator"
  if (distanceKm <= CLOSE_RATIO * scaleKm) return "close"
  return "distant"
}

/** Radii around the answer, shown on the map at the reveal. */
export interface ScoringZones {
  /** Full points inside this distance */
  fullPointsKm: number
  /** "Close" medal inside this distance */
  closeKm: number
}

export function scoringZones(seed: SeedObject, version: ScoringVersion): ScoringZones {
  if (version === 1) return { fullPointsKm: 400, closeKm: 1500 }
  const scaleKm = seed.scaleKm ?? DEFAULT_SCALE_KM
  return { fullPointsKm: FULL_POINTS_RATIO * scaleKm, closeKm: CLOSE_RATIO * scaleKm }
}

/** Score and medal for a guess `distanceKm` from `seed`, under the given rules. */
export function scoreGuess(
  distanceKm: number,
  hintsUsed: number,
  seed: SeedObject,
  version: ScoringVersion
): { score: number; medal: Medal } {
  if (version === 1) {
    const score = calculateScore(distanceKm, hintsUsed)
    return { score, medal: getMedal(distanceKm, score, false) }
  }
  const scaleKm = seed.scaleKm ?? DEFAULT_SCALE_KM
  const score = calculateScoreV2(distanceKm, hintsUsed, scaleKm)
  return { score, medal: getMedalV2(distanceKm, score, false, scaleKm) }
}

const EPOCH = new Date("2026-03-01T00:00:00Z").getTime()

export function getDayNumber(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00Z`).getTime()
  return Math.floor((date - EPOCH) / 86400000)
}
