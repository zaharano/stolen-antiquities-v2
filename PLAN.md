# Stolen Antiquities — Implementation Plan

> Reference: `GDD.md` for full design spec, `DESIGN.md` for all visual/interaction design direction.
>
> **Important:** `DESIGN.md` must be read before writing any UI code. It defines fonts, colors, animation timing, and the overall visual metaphor ("researcher's desk with a paper map"). Apply it from the first component onward — do not defer styling to a later phase.

---

## Phase 0: Project Scaffolding

**Goal:** Empty app runs locally with all tooling configured.

### Steps

1. **Initialize git repo** — `git init`, create `.gitignore` (node_modules, dist, .env, .DS_Store).
2. **Scaffold Vite + React + TypeScript** — `npm create vite@latest . -- --template react-ts` (in-place, since directory already exists).
3. **Install core dependencies:**
   ```
   npm install leaflet react-leaflet
   npm install -D @types/leaflet
   npm install -D tailwindcss @tailwindcss/vite
   ```
4. **Configure Tailwind** — Set up `tailwind.config.ts` and add Tailwind directives to `src/index.css` per current Tailwind v4 docs (use `@import "tailwindcss"` approach with the Vite plugin).
5. **Set up design tokens** — Per `DESIGN.md`:
   - Add custom colors to Tailwind config (`cream`, `parchment`, `sepia`, `ink`, `red`, `green`, `gold`, `amber` and their variants).
   - Add Google Fonts to `index.html`: `DM Serif Display` (headings), `Source Serif 4` (body), `JetBrains Mono` (data/scores).
   - Set up base font-family in Tailwind config.
   - Apply global background color (`cream`) and text color (`ink`).
   - Add the Leaflet sepia filter CSS from `DESIGN.md`.
6. **Verify** — `npm run dev` serves the default Vite page with Tailwind working, fonts loading, colors applied. Leaflet imports without error.
7. **Commit** — Initial scaffolding with design tokens.

### 🧑 User action required
- None.

---

## Phase 1: Seed List Curation

**Goal:** Produce `public/data/seed-objects.json` — a curated list of ~200 Met objects with manually assigned coordinates.

### Context

The CSV `MetObjects.csv` (612K rows) is the full Met collection export. It contains columns: `Is Public Domain`, `Is Highlight`, `Object ID`, `Title`, `Culture`, `Medium`, `Department`, `Country`, `Region`, `City`, `Object Date`, `Credit Line`, `AccessionYear`. The CSV does NOT contain image URLs — those come from the Met API at runtime.

### Steps

1. **Write a curation script** — `scripts/curate-seed-list.ts` (run with `npx tsx`).
   - Parse `MetObjects.csv`.
   - Filter to rows where:
     - `Is Public Domain` = `True`
     - `Is Highlight` = `True` (highlights are visually strong, high-quality objects)
     - `Country` is non-empty (needed for geocoding)
   - This should yield a manageable subset (a few hundred to low thousands).
   - Output a CSV or JSON of candidates with: `objectID`, `title`, `culture`, `country`, `region`, `city`, `medium`, `department`, `objectDate`.

2. **Geocode candidates** — `scripts/geocode-candidates.ts`.
   - For each candidate, use the `Country` + `Region` + `City` fields to assign `[lat, lng]`.
   - Strategy: build a **static lookup map** of known country/region/city → coordinates (no external geocoding API needed). The number of unique geographic combinations among highlighted public-domain objects will be finite and manageable. The script should:
     - Extract all unique `(Country, Region, City)` tuples from the candidates.
     - Print them out for manual coordinate assignment, OR auto-assign using a hardcoded mapping of common locations (e.g., "Egypt" → `[26.0, 30.0]`, "Egypt, Upper Egypt, Thebes" → `[25.74, 32.60]`).
   - Where `City` is available, use city-level coords. Where only `Country`, use a representative central point.
   - Output: candidates with `lat`/`lng` appended.

3. **Assign difficulty** — `scripts/assign-difficulty.ts`.
   - Heuristic: objects with specific city/region = "easy", country-only with distinctive culture = "medium", ambiguous culture/region = "hard".
   - Can also factor in how recognizable the culture field is.

4. **Manual review pass** — This is a combined automated + manual process:
   - The script outputs ~200–250 candidates to `public/data/seed-objects.json`.
   - Ensure geographic diversity: all inhabited continents represented.
   - Ensure difficulty spread: roughly 30% easy, 40% medium, 30% hard.
   - Spot-check a sample of object IDs against the Met API (`https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}`) to confirm `primaryImage` exists and looks good.

5. **Final seed list format** — `public/data/seed-objects.json`:
   ```json
   [
     {
       "objectID": 45734,
       "lat": 25.7402,
       "lng": 32.6014,
       "difficulty": "easy",
       "notes": "Temple of Hatshepsut, Luxor — strong visual cues"
     }
   ]
   ```
   Only `objectID`, `lat`, `lng`, `difficulty`, and optional `notes`. All other metadata is fetched from the Met API at runtime.

6. **Commit** — Seed list + curation scripts.

### 🧑 User action required
- Review the final seed list for quality / geographic diversity. The curation scripts will do the heavy lifting, but a human eye-check on the output is recommended. The agent should flag if the automated process produces fewer than 150 or more than 300 objects.

---

## Phase 2: Core Data Layer

**Goal:** Daily object selection works, Met API fetching works, types are defined.

### Steps

1. **Define TypeScript types** — `src/types.ts`:
   ```ts
   interface SeedObject {
     objectID: number
     lat: number
     lng: number
     difficulty: "easy" | "medium" | "hard"
     notes?: string
   }

   interface MetObject {
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

   interface GameRound {
     seed: SeedObject
     metData: MetObject
     playerGuess: [number, number] | null  // [lat, lng]
     distanceKm: number | null
     score: number | null
     hintsUsed: number
     timedOut: boolean
   }

   interface GameState {
     date: string               // "YYYY-MM-DD"
     rounds: GameRound[]
     currentRound: number       // 0-9
     phase: "splash" | "playing" | "reveal" | "results"
     completed: boolean
   }
   ```

2. **Daily selection function** — `src/lib/daily-selection.ts`:
   - Load seed list from `/data/seed-objects.json`.
   - Implement a deterministic hash: `hash(dateString)` → use it to select 10 objects from the seed list. Use a simple seeded PRNG (e.g., mulberry32) so the selection is shuffled but reproducible.
   - Export: `getDailyObjects(dateString: string): SeedObject[]`

3. **Met API client** — `src/lib/met-api.ts`:
   - `fetchMetObject(objectID: number): Promise<MetObject>` — fetches from `https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}`.
   - Include error handling for failed fetches / missing images.
   - Consider prefetching: when the game starts, fetch all 10 objects in parallel so there's no loading delay between rounds.

4. **Scoring function** — `src/lib/scoring.ts`:
   - `calculateDistance(lat1, lng1, lat2, lng2): number` — Haversine formula, returns km.
   - `calculateScore(distanceKm: number, hintsUsed: number): number` — continuous exponential decay curve using the GDD tier guideposts:
     - ≤50km → 1000, ~250km → ~750, ~1000km → ~400, ~5000km → ~100, beyond → approaches 0.
     - Subtract `hintsUsed * 150` from the result (floor at 0).
   - `getMedal(distanceKm: number, timedOut: boolean): "curator" | "close" | "continent" | "lost"` — per GDD §3.
   - For continent detection: a simple point-in-bounding-box check for each continent, or use a lightweight lookup based on lat/lng ranges.

5. **localStorage persistence** — `src/lib/storage.ts`:
   - `saveGameState(state: GameState): void`
   - `loadGameState(date: string): GameState | null`
   - `hasCompletedToday(): boolean`
   - Key format: `stolen-antiquities-{date}`

6. **Unit tests** — `src/lib/__tests__/`:
   - Test daily selection determinism (same date → same objects).
   - Test scoring function against known distance/score pairs from GDD.
   - Test Haversine with known city pairs.

7. **Commit** — Core data layer.

### 🧑 User action required
- None.

---

## Phase 3: Game Screen — Map + Object Panel

**Goal:** The main gameplay screen is functional: object displays, map interaction works, pin placement works.

### Steps

1. **App structure** — Set up React Router (or simple state-based routing) with screens:
   - `SplashScreen`
   - `GameScreen`
   - `ResultsScreen`
   - Use `GameState.phase` to control which screen is active. Simple conditional rendering is fine — no need for a router library.

2. **GameScreen layout** — `src/components/GameScreen.tsx`:
   - Desktop: side-by-side layout. Left panel (~350px) for object info, right side for map.
   - Mobile: map fills viewport, bottom sheet overlay for object info.
   - Use Tailwind responsive classes (`lg:`, `md:`) per GDD §10.

3. **ObjectPanel component** — `src/components/ObjectPanel.tsx`:
   - Displays: object image (from `primaryImageSmall`), title, date.
   - Image: lazy-load thumbnail, tap/click to view full-res (`primaryImage`) in a modal/lightbox.
   - Hint buttons: 3 buttons, each reveals the next hint. Visually indicate cost ("−150 pts"). Disable already-revealed hints.
   - On mobile: implement as a bottom sheet — collapsed shows image + title, expanded shows hints. Use a simple drag handle or tap-to-expand.

4. **MapView component** — `src/components/MapView.tsx`:
   - React Leaflet `<MapContainer>` with OpenStreetMap or CartoDB Positron tiles.
   - Initial view: `[20, 0]` zoom 2 (world view).
   - Click handler: places a draggable marker at clicked position. Clicking elsewhere moves the marker.
   - "Confirm Placement" button appears once a pin is placed. Positioned over the map, bottom-center.
   - On confirm: freeze map interaction, trigger reveal.

5. **Timer component** — `src/components/Timer.tsx`:
   - 30-second countdown bar/circle.
   - Visual pulse/color change at ≤10 seconds (e.g., bar turns red, gentle pulse animation via Tailwind `animate-pulse`).
   - At 0: auto-submit with no guess, trigger reveal with 0 points.

6. **Reveal overlay** — `src/components/RevealOverlay.tsx`:
   - After confirm (or timeout):
     - Drop a second marker at the correct location (different color — e.g., green vs player's blue).
     - Draw a great-circle line (or straight line, simpler) between guess and answer using Leaflet `<Polyline>`.
     - Display: distance in km, points earned, medal emoji.
     - "Next →" button appears after ~1.5s delay.
   - After the last object (round 10): "Next" becomes "See Results".

7. **Wire up game flow** — `src/hooks/useGameState.ts` (or a context/reducer):
   - Manages `GameState`, advances rounds, tracks hints, handles timer expiry.
   - On mount: check `localStorage` for today's game. If completed, go straight to results. If in-progress, resume. If new, start fresh.
   - Prefetch all 10 Met objects on game start.

8. **Commit** — Functional game screen.

### 🧑 User action required
- None.

---

## Phase 4: Splash Screen + Results Screen

**Goal:** Complete the non-gameplay screens.

### Steps

1. **SplashScreen** — `src/components/SplashScreen.tsx`:
   - App title: "Stolen Antiquities" — styled with museum/archaeological flair.
   - Subtitle: today's date, "10 objects to return".
   - "Start" button → transitions to GameScreen.
   - If already completed today: show "You've already played today" with a countdown to next game (midnight UTC) and a "View Results" button.

2. **ResultsScreen** — `src/components/ResultsScreen.tsx`:
   - **Total score** prominently displayed (e.g., "7,450 / 10,000").
   - **Per-object breakdown** — scrollable list:
     - Thumbnail, title, distance, points, medal emoji, hints used.
     - Tapped-out objects marked distinctly.
   - **Summary stats**: average distance, best/worst object, total hints used.
   - **Map overview**: React Leaflet map showing all 10 correct locations (green pins) with lines from player guesses (blue pins). Fit bounds to show all markers.
   - **Share button** — generates Wordle-style text (see step 3), copies to clipboard with `navigator.clipboard.writeText()`. Show brief "Copied!" toast.

3. **Share text generation** — `src/lib/share.ts`:
   ```
   🏛️ Stolen Antiquities #{dayNumber} — {score}/10,000

   {medal1}{medal2}{medal3}{medal4}{medal5}
   {medal6}{medal7}{medal8}{medal9}{medal10}

   ⏱️ {n} hints used
   stolenantiquities.app
   ```
   - `dayNumber` = days since a fixed epoch (e.g., 2026-03-01).
   - Medal emojis: 🏛️ (curator), 🎯 (close), 🌍 (continent), ❌ (lost).

4. **Commit** — All screens complete.

### 🧑 User action required
- None.

---

## Phase 5: Visual Polish + Mobile UX

**Goal:** Refine the existing styled components. Fonts, colors, and design tokens were established in Phase 0 and applied throughout Phases 3-4. This phase is about tightening details and ensuring the full "researcher's desk" metaphor holds together. Refer to `DESIGN.md` throughout.

### Steps

1. **Map tile refinement**:
   - Verify CartoDB Positron + sepia CSS filter looks right. Adjust filter values if needed.
   - Custom pin icons: red pushpin (SVG `divIcon`) for player guess, muted green pin for correct answer.
   - Dotted red line between guess and answer — styled per `DESIGN.md` (draws itself over ~700ms).

2. **Mobile bottom sheet**:
   - Smooth drag-to-expand behavior for the object panel on mobile.
   - Collapsed state: ~100px, shows thumbnail + title + timer.
   - Expanded: full image + hint buttons.
   - Ensure map is still interactable when sheet is collapsed.

4. **Animations & transitions**:
   - Object image fade-in on load.
   - Score counter animation (count up from 0 to earned points).
   - Timer pulse at ≤10s.
   - Pin drop animation on reveal.
   - Screen transitions (fade or slide).

5. **Image handling**:
   - Use `primaryImageSmall` for the in-game thumbnail.
   - Lazy-load with a placeholder/skeleton.
   - Full-res modal: load `primaryImage` on tap, show loading spinner.
   - Handle missing images gracefully (show placeholder + "Image unavailable").

6. **Responsive testing**:
   - Test at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px+.
   - Ensure map is usable on small screens — pin placement should be easy with fingers.
   - Confirm button must be reachable on all screen sizes.

7. **Commit** — Polish pass.

### 🧑 User action required
- Provide feedback on visual direction after seeing the initial implementation. The agent will make reasonable default choices, but tone/color/typography are subjective.

---

## Phase 6: Edge Cases, Error Handling & QA

**Goal:** The app is robust and handles all failure modes.

### Steps

1. **Met API failures**:
   - If an object fetch fails, retry once, then show a fallback state ("Unable to load this object — skipping") and auto-advance.
   - If the image URL returns a 404 or fails to load, show a placeholder.
   - Handle the case where the Met API is completely down: show an error screen with a retry button.

2. **Empty hint fields**:
   - Per GDD §4: if a hint field (`culture`, `medium`, `department`) is empty for an object, skip it and show the next available hint. If all hint fields are empty, hide the hint buttons for that object.

3. **localStorage edge cases**:
   - Handle corrupted/malformed data gracefully (catch JSON parse errors, reset if needed).
   - Handle `localStorage` being unavailable (private browsing in some browsers): show a warning that progress won't be saved, but allow play.

4. **Timer precision**:
   - Use `requestAnimationFrame` or `setInterval` with drift correction — ensure the timer is accurate even if the tab is backgrounded briefly.
   - If the tab is backgrounded for a long time (e.g., >30s), auto-expire the current round on return.

5. **Viewport issues**:
   - Leaflet map resize handling: call `map.invalidateSize()` when layout changes (e.g., bottom sheet expand/collapse).
   - iOS Safari: handle viewport height issues with `100dvh` instead of `100vh`.

6. **Accessibility basics** (v1 scope):
   - Ensure sufficient color contrast (WCAG AA).
   - All images have alt text (object title).
   - Buttons are keyboard-focusable.
   - Timer has an aria-live region so screen readers announce time warnings.

7. **Commit** — Hardening pass.

### 🧑 User action required
- None.

---

## Phase 7: Build & Deploy

**Goal:** App is live on the internet.

### Steps

1. **Production build**:
   - `npm run build` — verify no errors, check bundle size.
   - Ensure `public/data/seed-objects.json` is included in the build output.

2. **Vercel deployment**:
   - Connect the GitHub repo to Vercel (or run `npx vercel` for CLI deploy).
   - Framework preset: Vite.
   - No environment variables needed (no API keys).
   - Verify the deployed URL works end-to-end.

3. **Domain (optional)**:
   - If the user has `stolenantiquities.app` or similar, configure it in Vercel.

4. **Final smoke test**:
   - Play a full game on the deployed URL on both desktop and mobile.
   - Verify: daily selection is the same across devices, localStorage persists, share text is correct, Met API images load.

5. **Commit** — Any deploy-related config changes.

### 🧑 User action required
- **Set up Vercel project** — connect the GitHub repo to Vercel (requires Vercel account + GitHub auth). The agent cannot do this step.
- **Push to GitHub** — create the remote repo and push. The agent can prepare the commands but the user must have the repo created on GitHub.
- **Domain configuration** — if desired, this is a Vercel dashboard action.

---

## Execution Notes for the Agent

- **Always check GDD.md** for authoritative design decisions before implementing.
- **Met API is public, no key needed.** Base URL: `https://collectionapi.metmuseum.org/public/collection/v1`
- **MetObjects.csv** (612K rows) is in the project root — use it for seed list curation. It does NOT contain image URLs.
- **No backend.** Everything is client-side. Don't introduce a server.
- **Keep it simple.** No state management library (useState/useReducer + context is sufficient). No CSS-in-JS. No component library — hand-roll with Tailwind.
- **Mobile-first.** Design for 375px width first, then scale up.
- Each phase should end with a working, committable state. Don't leave broken builds between phases.
