export type Difficulty = "easy" | "medium" | "hard"
export type Medal = "curator" | "close" | "distant" | "lost"
export type GamePhase = "splash" | "playing" | "reveal" | "results"

export interface SeedObject {
  objectID: number
  lat: number
  lng: number
  difficulty: Difficulty
  notes?: string
}

export interface MetObject {
  objectID: number
  title: string
  primaryImage: string
  primaryImageSmall: string
  objectDate: string
  culture: string
  medium: string
  department: string
  creditLine: string
  accessionYear: string
  country: string
  region: string
  city: string
}

export interface GameRound {
  seed: SeedObject
  metData: MetObject | null   // null while loading
  playerGuess: [number, number] | null  // [lat, lng]
  distanceKm: number | null
  score: number | null
  medal: Medal | null
  hintsUsed: number
  timedOut: boolean
}

export interface GameState {
  date: string               // "YYYY-MM-DD"
  rounds: GameRound[]
  currentRound: number       // 0-9
  phase: GamePhase
  completed: boolean
}
