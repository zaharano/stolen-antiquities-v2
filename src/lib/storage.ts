import type { GameState, GameHistoryEntry } from "../types"
import { getDayNumber } from "./scoring"

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

const HISTORY_KEY = "stolen-antiquities-history"

export function getGameHistory(): GameHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as GameHistoryEntry[]
  } catch {
    return []
  }
}

export function appendGameToHistory(state: GameState): void {
  if (!state.completed) return
  try {
    const history = getGameHistory()
    const entry: GameHistoryEntry = {
      date: state.date,
      dayNumber: getDayNumber(state.date),
      score: state.rounds.reduce((sum, r) => sum + (r.score ?? 0), 0),
      medals: state.rounds.map((r) => r.medal),
    }
    // Replace existing entry for this date if present, otherwise append
    const idx = history.findIndex((h) => h.date === state.date)
    if (idx >= 0) {
      history[idx] = entry
    } else {
      history.push(entry)
    }
    // Keep sorted newest-first
    history.sort((a, b) => b.date.localeCompare(a.date))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // localStorage unavailable — silently ignore
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
