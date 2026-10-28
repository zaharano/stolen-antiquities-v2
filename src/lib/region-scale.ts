import { calculateDistance } from "./scoring"

// Scoring v2 scale for an answer location, used by the seed pipeline
// (scripts/geocode-and-finalize.ts) to fill seed.scaleKm. Not used at runtime.
//
// The idea: how far is a "near miss" here? Where many countries sit close
// together (Europe), a few hundred km is already another country; where they
// are far apart (East Asia, the Pacific, the Americas), it isn't. So the scale
// grows with the distance to the nearest other countries' centres.

/** How many neighbouring country centres to average over */
export const SCALE_NEIGHBOURS = 5
export const SCALE_FACTOR = 1.7
export const MIN_SCALE_KM = 700
export const MAX_SCALE_KM = 2200

export function regionScaleKm(
  lat: number,
  lng: number,
  countryCentroids: readonly (readonly [number, number])[]
): number {
  const distances = countryCentroids
    .map(([cLat, cLng]) => calculateDistance(lat, lng, cLat, cLng))
    .sort((a, b) => a - b)
  // Skip the nearest centre, which is usually the answer's own country
  const neighbours = distances.slice(1, 1 + SCALE_NEIGHBOURS)
  const mean = neighbours.reduce((sum, d) => sum + d, 0) / neighbours.length
  const rounded = Math.round((SCALE_FACTOR * mean) / 50) * 50
  return Math.min(MAX_SCALE_KM, Math.max(MIN_SCALE_KM, rounded))
}
