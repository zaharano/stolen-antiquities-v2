# AGENTS.md — Stolen Antiquities

Orientation for coding agents (and humans) picking this repo up. Read this first; it is
kept short on purpose and points at the code. When this file and `docs/` disagree with the
code, **the code wins**. `docs/GDD.md` and `docs/PLAN.md` are the original v1 design
and build plan and are partly stale (see "Docs drift" below).

Forward-looking work lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## What it is

A daily, Wordle-style geography game. Every day, every player gets the same 10 objects from
the Metropolitan Museum of Art. For each object you get 30 s to drop a pin on a world map
where you think it came from. Points depend on distance; hints cost points. At the end
there's a results screen and a shareable emoji grid.

- **100% client-side.** No backend, no auth. Vite + React 19 + TypeScript, Tailwind v4,
  Leaflet via `react-leaflet` v5.
- **Answers live in a static JSON file** (`public/data/seed-objects.json`). Object metadata
  and images are fetched from the Met API at runtime. Map tiles come from Stadia Maps.
- **State lives in `localStorage`.**

## Commands

```bash
npm ci            # install (lockfile must stay in sync; use `npm install` to update it)
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build  → dist/
npm run lint      # eslint (clean; keep it that way)
npm test          # vitest run (unit tests for src/lib/*)
npm run test:e2e  # Playwright: builds, serves, and checks layout on 7 phone/tablet/desktop sizes
npm run preview   # serve dist/

# Seed-list pipeline (offline, only when changing the object pool)
npx tsx scripts/curate-seed-list.ts      # needs MetObjects.csv at repo root (gitignored, ~300MB, from github.com/metmuseum/openaccess)
npx tsx scripts/geocode-and-finalize.ts  # candidates.json → public/data/seed-objects.json (deterministic)
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test and build, plus the Playwright
suite as a second job, on PRs and pushes to `main`. Unit tests live next to the code as
`src/lib/*.test.ts`; browser tests are `e2e/*.e2e.ts`, with network stubs and overlap
helpers in `e2e/fixtures.ts`. Deploy is a gitignored local
`deploy.sh`. The live site is **stolen-antiquities.com**.

---

## Map of the code

```
src/
  main.tsx                 React root; imports leaflet.css + index.css
  App.tsx                  Phase router: splash → playing/reveal → results
  types.ts                 SeedObject, MetObject, GameRound, GameState, GameHistoryEntry, Medal
  hooks/useGameState.ts    THE game state machine (init, placePin, guess, timeout, hints, next, results, loadError)
  hooks/useMediaQuery.ts   Live CSS media query (picks side-panel vs mobile layout)
  lib/
    daily-selection.ts     Date → 10 seeds (seeded PRNG + Fisher–Yates). Determinism lives here.
    scoring.ts             Distance, v1 + v2 score curves, medals, scoring zones, version-by-date, day number
    region-scale.ts        Pipeline-only: per-answer scoring scale from neighbouring country centres
    round.ts               ROUND_SECONDS and resolveRound(): turn a guess (or none) into a scored round
    met-api.ts             Fetch Met objects (batches of 5, retry on 429, 8 s timeout)
    map-tiles.ts           Tile provider config (Stadia styles, OSM fallback), env-driven
    storage.ts             localStorage read/write, UTC "today", history
    share.ts               Share text + MEDAL_EMOJIS
  components/
    SplashScreen.tsx       Title, Begin / View Results / Practice, past-games list
    GameScreen.tsx         Layout: side panel (desktop, phone landscape) vs HUD + map + sheet (phone portrait)
    BottomSheet.tsx        Mobile object sheet: in flow under the map, tap/swipe to open or collapse
    BaseTileLayer.tsx      The one TileLayer both maps use; falls back to OSM if the primary fails
    MapView.tsx            Leaflet map for play: click-to-pin, reset view per round, fit bounds on reveal
    ObjectPanel.tsx        Image (+ portal full-res modal), title/date, hints; "side" and "sheet" variants; ObjectPeek
    RevealOverlay.tsx      "Confirm Placement" button, then the reveal card (medal, distance, count-up score)
    Timer.tsx              Countdown bar derived from the round's startedAt (survives reloads and background tabs)
    ResultsScreen.tsx      Totals, per-object cards, overview map (touch-gated), share sheet/clipboard, countdown
  index.css                Tailwind @theme tokens (colors/fonts), keyframes, Leaflet sepia filter
public/data/seed-objects.json   283 objects: { objectID, lat, lng, difficulty, notes, scaleKm }
e2e/                       Playwright layout/behaviour tests (playwright.config.ts lists the device sizes)
scripts/
  curate-seed-list.ts      MetObjects.csv → candidates.json (public domain + highlight + has country)
  geocode-and-finalize.ts  Static lookup tables CITY_COORDS / REGION_COORDS / COUNTRY_COORDS, difficulty heuristic,
                           per-country caps, scaleKm (+ SCALE_OVERRIDES) → seed-objects.json
  candidates.json          706 candidates (committed)
  candidates-filtered.csv  Raw CSV rows for those candidates (committed, for reference)
docs/  GDD.md (game design), DESIGN.md (visual system — still authoritative), PLAN.md (original build plan)
```

### Runtime flow

1. `SplashScreen` → `initGame()` in `useGameState`.
2. If `localStorage["stolen-antiquities-YYYY-MM-DD"]` exists, resume it (`results` if
   completed, else `playing`/`reveal`). **The saved state embeds the seeds and fetched Met
   data**, so a resumed game never re-runs selection or re-fetches.
3. Otherwise show the loading screen, fetch `/data/seed-objects.json` →
   `getDailyObjects(date, seeds)` → `prefetchDailyObjects()` (all 10 Met objects up front;
   individual failures become `metData: null`). If the seed list fails, `loadError` is set
   and `App` shows an error screen with "Try again".
4. Per round: the round's `startedAt` is set when it begins. A map tap calls `placePin`,
   which saves `pendingGuess`. Confirm → `submitGuess` → `resolveRound()` scores it →
   phase `reveal` → `nextRound`. Timer expiry → `submitTimeout`, which **scores the
   pending pin if there is one** (as the GDD intended), else the round is lost (score 0).
   Actions read the latest state from `stateRef`, so timer callbacks never act on a stale
   snapshot.
5. After round 10 → `completed: true`, append to `stolen-antiquities-history`, show results.

### Invariants: read before changing these

- **Daily determinism.** All players must get the same 10 objects for a given UTC date.
  `getDailyObjects` output depends on *both* the algorithm *and the exact contents/order of
  `seed-objects.json`*. Changing either changes everyone's game for every date, including
  today's (players mid-game are safe because state embeds seeds, but two players on the same
  day could see different sets across a deploy). Any change to selection or the seed list
  should be **versioned with a cutover date** (keep the old path for dates before it).
- **"Today" is UTC** (`getTodayDateString` uses `toISOString`). Rollover is midnight UTC.
  The day number (`#N` in share text) counts from `EPOCH` in `scoring.ts` (2026-03-01).
- **localStorage schema.** Keys: `stolen-antiquities-<date>` (full `GameState`) and
  `stolen-antiquities-history` (`GameHistoryEntry[]`, newest first). There is no schema
  version field; add one before making breaking changes to `GameState`.
- **Practice mode** must never write to storage. All writes go through `persist()` in
  `useGameState`, which checks `practiceModeRef`. Never call `saveGameState` directly.
- **Scoring rules are chosen by game date** (`scoringVersionFor(state.date)`), never by
  deploy, so everyone playing the same day is scored the same way. v2 starts at
  `SCORING_V2_START` (2026-11-01). Changing the curve again means adding a v3 with its own
  start date and keeping v1/v2 intact.
- **Answers are public** (they're in the static JSON). Accepted for v1; it matters only if
  leaderboards are added.

### Scoring (`src/lib/scoring.ts`)

Entry point: `scoreGuess(distanceKm, hintsUsed, seed, version)`, called from
`resolveRound()`. `scoringZones(seed, version)` gives the radii drawn at the reveal.

- **v2 (game dates ≥ 2026-11-01): region-scaled.** Each seed has `scaleKm` (700–2200),
  which is tight where countries are packed together (Europe) and loose where they're
  sparse (East Asia, the Americas, Oceania). With `x = distance / scaleKm`: full points for
  x ≤ 0.25, then `1000·(1 − (x−0.25)/2.75)³`, zero at x ≥ 3. Medals: `curator` x ≤ 0.25,
  `close` x ≤ 1, else `distant`. A 1000 km miss scores 187 near Paris, 534 near Isfahan
  and 793 near Beijing. The tuning table is in `docs/ROADMAP.md` (Phase 3). Seeds without
  `scaleKm` fall back to `DEFAULT_SCALE_KM` (1600).
- **v1 (earlier dates): one curve everywhere.** ≤ 400 km → 1000, then `1000·(1−t)^6` with
  `t = (d−400)/3600`, 0 at 4000 km. Medals: `curator` ≤ 400 km, `close` ≤ 1500 km.
- Both: hint penalty **`HINT_PENALTY` (75) per hint**, floored at 0; `lost` if timed out
  or score 0. Emoji in `share.ts`.
- `scaleKm` is computed by `regionScaleKm()` (`src/lib/region-scale.ts`) in the seed
  pipeline, from country centres in the `world-countries` dev dependency (ODbL, used
  offline only). Override odd cases in `SCALE_OVERRIDES` in the pipeline and regenerate.

### Hints (`ObjectPanel.getHints`)

Built at runtime from Met data: (1) `medium`, (2) `department — creditLine`. Culture is
deliberately *not* a hint (it usually gives the answer away). Hints unlock in order.

### Map tiles

Both maps render `<BaseTileLayer />`, configured in `src/lib/map-tiles.ts`.

- **Primary: Stadia Maps**, style from `VITE_MAP_STYLE` (`alidade_smooth` by default; also
  `stamen_toner_lite`, `stamen_watercolor`). Free for non-commercial use (this game is
  non-commercial). Browsers authenticate by **domain**: `stolen-antiquities.com` must be
  registered under "Manage Properties" in the Stadia dashboard. localhost needs no setup.
  `VITE_STADIA_API_KEY` exists for hosts where domain auth can't work, but it ships in the
  bundle. See `.env.example`.
- **Fallback: OpenStreetMap** standard tiles. Used automatically after 4 tile errors with
  no successful load (e.g. Stadia 401 for an unregistered domain), with a console warning.
  This is an emergency path only; the OSM tile policy doesn't allow relying on it.
- History: the game launched on keyless CARTO Positron. CARTO started requiring a key and
  watermarking keyless tiles "API KEY REQUIRED", which is what broke the map in 2026.

### Styling conventions

- Colors and fonts are Tailwind v4 `@theme` tokens in `src/index.css` (`bg-cream`,
  `text-ink`, `border-sepia`, `bg-red`, `text-gold`, …). `docs/DESIGN.md` is the source of
  truth for the visual language ("paper map on a desk").
- Components often set `fontFamily` inline (`'DM Serif Display'`, `'Source Serif 4'`,
  `'JetBrains Mono'`) and some hex colors inline. Prefer the `font-display` / `font-body` /
  `font-mono` tokens in new code. Match surrounding code when editing.
- **Layout.** `GameScreen` picks one layout with `useMediaQuery`: a side panel when
  `(min-width: 1024px)` or a short landscape screen (`max-height: 500px`), otherwise a
  column of HUD bar → map → `BottomSheet`. **Only one layout is mounted.** The sheet is in
  normal flow, not floating, so the map area shrinks when it opens and anything anchored
  to the bottom of the map can't end up under it. `MapView` watches its container with a
  `ResizeObserver` (`invalidateSize({ pan: false })`, so the map doesn't shift under a
  finger). Any pointerdown on the map collapses the sheet.
- **z-index.** `.leaflet-container` has `isolation: isolate`, so Leaflet's internal
  z-indexes (panes 400, controls 1000) stay inside the map. Overlays on the map
  (Confirm button, reveal card) use `z-[500]`; the full-size image modal is portalled to
  `<body>` at `z-[2000]`. The sepia filter is on `.leaflet-tile-pane` only.
- **Bottom of the map.** Leaflet's attribution is bottom-right (rarely tapped there,
  unlike the top). The Confirm button and reveal card sit at `bottom-9` to clear it, and
  `BoundsFitter` keeps pins above the card (`REVEAL_CARD_SPACE`).
- **Safe areas.** `viewport-fit=cover` is on, so every screen pads with
  `env(safe-area-inset-*)` (HUD top, sheet bottom, sides of the game root, splash and
  results). Keep that when adding full-bleed UI.
- **`short:` variant** (`@custom-variant` in `index.css`) = `max-height: 500px`, i.e.
  phones in landscape. Use it for compact spacing.
- **Touch.** Double-tap zoom is off on coarse pointers (it would also drop a pin). Tap
  targets are at least 44 px (`min-h-11`). The results map starts locked on touch screens
  ("Tap to explore the map") so one-finger drags scroll the page.
- Components that reset per round (`Timer`, `ObjectPanel`, `RevealOverlay`) are **keyed by
  round/object** in `GameScreen` instead of resetting state in effects. Keep that pattern;
  the `react-hooks/set-state-in-effect` lint rule enforces it.

---

## Known issues (found during the Oct 2026 revival audit)

Fixed in Phase 0: the practice-timeout overwrite, the double Timer/ObjectPanel, the hint
cost label, "Perfect" → "Curator", no error handling or fetch timeout in `initGame`, the
dishonest "Copied!" fallback, and the wrong domain in the share text.

Fixed in Phase 2 (mobile): zoom control hidden under the timer, the 75 dvh sheet, Confirm
and reveal card overlapping the sheet, no safe areas, the image modal under the HUD, the
results-map scroll trap, phone landscape, the timer resetting on reload, the lost pending
pin, and the attribution covering the reveal card. `e2e/game.e2e.ts` guards all of these.

Still open:
- A Met failure is saved as `metData: null` for the whole day, with no retry.
- Practice ("Play again") replays the **same** 10 objects as the daily game.
- Android's back button leaves the site mid-game (progress is saved, so Begin resumes).
- Verified in Chromium device emulation only; still needs a pass on real iOS Safari and
  Android Chrome.

Data and pipeline:
- `isGameplayRelevant()` in `geocode-and-finalize.ts` is **defined but never called**, so
  the seed list still contains American Wing (18), Libraries (31) and European
  musical-instrument objects. That's why London (16), Paris (15) and Nuremberg (8) are
  among the most common answers.
- The pool is ~45% Europe and has only ~13 sub-Saharan Africa objects. 16 objects share the
  exact Thebes/Luxor coordinate and 16 share central London.
- `difficulty` is never `hard` (country-level coords are never used) and is unused at
  runtime.
- Re-running `geocode-and-finalize.ts` reproduces the committed seed file byte-for-byte.
  Keep it that way: the pipeline should be the only writer of `seed-objects.json`.


### Docs drift (GDD vs code)

The GDD's scoring table (≤ 50 km perfect, 5000 km cutoff), medals (🌍 Continent), and
3 × −150 hints describe the original design, not the shipped tuning in `scoring.ts`.
`PLAN.md` is a historical build log.

---

## Working in this repo

- Keep `src/lib/*` pure and framework-free; put React state in `useGameState`.
- Any change to selection, the seed list, or scoring changes the game for everyone. Call
  it out in the PR and say whether it needs a cutover date.
- Run `npm run lint && npm test && npm run build` before pushing, plus
  `npm run test:e2e` after any UI change; CI runs all of them.
- The e2e suite covers 280×653 (Fold), 375×667 (iPhone SE), 393×852, 412×915, 844×390
  (phone landscape), 768×1024 (iPad) and 1280×800. Its `expectOnTop` / `expectNoOverlap`
  helpers are the quickest way to pin a new layout rule. Tests attach screenshots
  (`--reporter=html` to browse them). Playwright + Chromium is preinstalled in cloud sessions;
  `@playwright/test` is pinned to the same version (1.63.0). External hosts (Met API, Stadia, OSM) may be blocked by the sandbox
  network policy, so stub them with `context.route()` when testing there.
- Never hand-edit `seed-objects.json`; change the pipeline and regenerate.
