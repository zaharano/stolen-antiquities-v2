import type { GameState } from "../types"

function getKey(date: string): string {
  return `stolen-antiquities-${date}`
}

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0]
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(getKey(state.date), JSON.stringify(state))
  } catch {
    // localStorage unavailable (e.g., Safari private mode) — silently ignore
  }
}

export function loadGameState(date: string): GameState | null {
  try {
    const raw = localStorage.getItem(getKey(date))
    if (raw === null) return null
    return JSON.parse(raw) as GameState
  } catch {
    return null
  }
}

export function hasCompletedToday(): boolean {
  try {
    const state = loadGameState(getTodayDateString())
    return state?.completed ?? false
  } catch {
    return false
  }
}
