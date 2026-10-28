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
npm run preview   # serve dist/

# Seed-list pipeline (offline, only when changing the object pool)
npx tsx scripts/curate-seed-list.ts      # needs MetObjects.csv at repo root (gitignored, ~300MB, from github.com/metmuseum/openaccess)
npx tsx scripts/geocode-and-finalize.ts  # candidates.json → public/data/seed-objects.json (deterministic)
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test and build on PRs and pushes to
`main`. Tests live next to the code as `src/lib/*.test.ts`. Deploy is a gitignored local
`deploy.sh`. The live site is **stolen-antiquities.com**.

---

## Map of the code

```
src/
  main.tsx                 React root; imports leaflet.css + index.css
  App.tsx                  Phase router: splash → playing/reveal → results
  types.ts                 SeedObject, MetObject, GameRound, GameState, GameHistoryEntry, Medal
  hooks/useGameState.ts    THE game state machine (init, guess, timeout, hints, next, results, loadError)
  hooks/useMediaQuery.ts   Live CSS media query (picks desktop vs mobile layout)
  lib/
    daily-selection.ts     Date → 10 seeds (seeded PRNG + Fisher–Yates). Determinism lives here.
    scoring.ts             Haversine distance, score curve, hint penalty, medals, day number (epoch 2026-03-01)
    met-api.ts             Fetch Met objects (batches of 5, retry on 429, 8 s timeout)
    map-tiles.ts           Tile provider config (Stadia styles, OSM fallback), env-driven
    storage.ts             localStorage read/write, UTC "today", history
    share.ts               Share text + MEDAL_EMOJIS
  components/
    SplashScreen.tsx       Title, Begin / View Results / Practice, past-games list
    GameScreen.tsx         Layout: desktop side panel (lg+) vs mobile bottom sheet; mounts Timer, MapView, ObjectPanel, RevealOverlay
    BaseTileLayer.tsx      The one TileLayer both maps use; falls back to OSM if the primary fails
    MapView.tsx            Leaflet map for play: click-to-pin, reset view per round, fit bounds on reveal
    ObjectPanel.tsx        Image (+ full-res modal), title/date, progressive hints
    RevealOverlay.tsx      "Confirm Placement" button, then the reveal card (medal, distance, count-up score)
    Timer.tsx              30 s countdown bar, handles tab backgrounding
    ResultsScreen.tsx      Totals, per-object cards, overview map, share, countdown
  index.css                Tailwind @theme tokens (colors/fonts), keyframes, Leaflet sepia filter
public/data/seed-objects.json   283 objects: { objectID, lat, lng, difficulty, notes }
scripts/
  curate-seed-list.ts      MetObjects.csv → candidates.json (public domain + highlight + has country)
  geocode-and-finalize.ts  Static lookup tables CITY_COORDS (l.43) / REGION_COORDS (l.268) / COUNTRY_COORDS (l.328),
                           difficulty heuristic, per-country caps (l.820) → seed-objects.json
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
4. Per round: map click sets a pending pin (local state in `GameScreen`) → Confirm →
   `submitGuess` computes distance/score/medal → phase `reveal` → `nextRound`.
   Timer expiry → `submitTimeout` (score 0, medal `lost`).
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
- **Answers are public** (they're in the static JSON). Accepted for v1; it matters only if
  leaderboards are added.

### Scoring (as implemented, `src/lib/scoring.ts`)

- ≤ 400 km → 1000. Then `1000·(1−t)^6` with `t = (d−400)/3600`, reaching 0 at 4000 km.
  Roughly: 600 km ≈ 710, 900 km ≈ 408, 1500 km ≈ 112, 2000 km ≈ 29.
- Hint penalty: **`HINT_PENALTY` (75) per hint used**, floored at 0. The hint buttons read
  the same constant.
- Medals: `curator` ≤ 400 km, `close` ≤ 1500 km, `distant` otherwise, `lost` if timed out or
  score 0. Emoji in `share.ts`.
- The curve is the same everywhere in the world. Region-aware scoring is a roadmap item.

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
- Leaflet z-index: overlays on the map use `z-[1000]`; the mobile bottom sheet uses
  `z-[900]`. `.leaflet-container` has `isolation: isolate`, so Leaflet's internal z-indexes
  (panes 400, controls 1000) stay inside the map and below sibling overlays. The sepia
  filter is on `.leaflet-tile-pane` only, so pins keep their true colours.
- Layout breakpoint is 1024 px (`useMediaQuery("(min-width: 1024px)")` in `GameScreen`):
  side panel on desktop, bottom sheet below that. **Only one layout is mounted.**
- Components that reset per round (`Timer`, `ObjectPanel`, `RevealOverlay`) are **keyed by
  round/object** in `GameScreen` instead of resetting state in effects. Keep that pattern;
  the `react-hooks/set-state-in-effect` lint rule enforces it.

---

## Known issues (found during the Oct 2026 revival audit)

Fixed in Phase 0: the practice-timeout overwrite, the double Timer/ObjectPanel, the hint
cost label, "Perfect" → "Curator", no error handling or fetch timeout in `initGame`, the
dishonest "Copied!" fallback, and the wrong domain in the share text.

Still open:
- **Reloading mid-round resets the timer to 30 s** and drops the pending pin.
- A Met failure is saved as `metData: null` for the whole day, with no retry.
- Practice ("Play again") replays the **same** 10 objects as the daily game.

Mobile (details and a fix plan are in the roadmap):
- The mobile timer bar (`absolute top-0 z-[1000]`) covers Leaflet's top-left zoom "+".
- The bottom sheet opens at 75 dvh, which leaves about a quarter of the map tappable. It
  doesn't collapse when you interact with the map and can't be dragged.
- The Confirm button and reveal card (`bottom-6`) overlap the bottom sheet. There's no
  `safe-area-inset` handling for the iPhone home indicator, and no `viewport-fit=cover`.
- The full-res image modal (`z-50`) renders inside the sheet's `z-[900]` stacking context,
  so the timer bar and Confirm button draw on top of it.
- The results overview map captures one-finger drags (scroll trap on phones).
- Phone landscape gets the portrait bottom-sheet layout, which is unusable at ~390 px tall.

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
- Run `npm run lint && npm test && npm run build` before pushing; CI runs the same.
- After UI changes, check at least 375×667 (iPhone SE), 390×844 (iPhone 13/14), 844×390
  (phone landscape) and ≥1024 desktop. Playwright + Chromium is available in cloud sessions
  for screenshot checks. External hosts (Met API, Stadia, OSM) may be blocked by the sandbox
  network policy, so stub them with `context.route()` when testing there.
- Never hand-edit `seed-objects.json`; change the pipeline and regenerate.
