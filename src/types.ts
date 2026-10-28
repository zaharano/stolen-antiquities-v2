export type Difficulty = "easy" | "medium" | "hard"
export type Medal = "curator" | "close" | "distant" | "lost"
export type GamePhase = "splash" | "playing" | "reveal" | "results"

export interface SeedObject {
  objectID: number
  lat: number
  lng: number
  difficulty: Difficulty
  notes?: string
  /** Scoring v2 scale in km (how spread out the answer's region is); from the seed pipeline */
  scaleKm?: number
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
  /** Epoch ms when this round's timer started; lets a reload resume the countdown */
  startedAt?: number
  /** Pin placed but not yet confirmed; submitted automatically if time runs out */
  pendingGuess?: [number, number] | null
}

export interface GameState {
  date: string               // "YYYY-MM-DD"
  rounds: GameRound[]
  currentRound: number       // 0-9
  phase: GamePhase
  completed: boolean
}

export interface GameHistoryEntry {
  date: string               // "YYYY-MM-DD"
  dayNumber: number
  score: number
  medals: (Medal | null)[]   // one per round
}
