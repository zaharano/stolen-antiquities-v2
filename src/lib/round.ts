import type { GameRound } from "../types"
import { calculateDistance, scoreGuess, type ScoringVersion } from "./scoring"

/** Seconds the player has to place and confirm a pin for each object. */
export const ROUND_SECONDS = 30

/**
 * Score a round. `guess` is the confirmed pin, or the unconfirmed pin left on
 * the map when time ran out. With no guess at all the round is lost.
 */
export function resolveRound(
  round: GameRound,
  guess: [number, number] | null,
  version: ScoringVersion
): GameRound {
  if (!guess) {
    return {
      ...round,
      playerGuess: null,
      pendingGuess: null,
      distanceKm: null,
      score: 0,
      medal: "lost",
      timedOut: true,
    }
  }

  const [lat, lng] = guess
  const distanceKm = calculateDistance(lat, lng, round.seed.lat, round.seed.lng)
  const { score, medal } = scoreGuess(distanceKm, round.hintsUsed, round.seed, version)
  return {
    ...round,
    playerGuess: guess,
    pendingGuess: null,
    distanceKm,
    score,
    medal,
    timedOut: false,
  }
}
