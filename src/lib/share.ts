import type { GameState, Medal } from "../types"
import { getDayNumber } from "./scoring"

export const MEDAL_EMOJIS: Record<Medal, string> = {
  curator: "🏛️",
  close: "🎯",
  distant: "🗺️",
  lost: "❌",
}

export function generateShareText(state: GameState): string {
  const dayNumber = getDayNumber(state.date)

  const totalScore = state.rounds.reduce(
    (sum, round) => sum + (round.score ?? 0),
    0
  )

  const totalHints = state.rounds.reduce(
    (sum, round) => sum + round.hintsUsed,
    0
  )

  const medalRow = state.rounds.map((round) =>
    round.medal ? MEDAL_EMOJIS[round.medal] : "⬜"
  )

  const row1 = medalRow.slice(0, 5).join("")
  const row2 = medalRow.slice(5, 10).join("")

  return [
    `🏛️ Stolen Antiquities #${dayNumber} — ${totalScore.toLocaleString()}/10,000`,
    "",
    row1,
    row2,
    "",
    `⏱️ ${totalHints} hints used`,
    "stolenantiquities.app",
  ].join("\n")
}
