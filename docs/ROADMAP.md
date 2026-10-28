# Roadmap: Stolen Antiquities revival (Oct 2026)

Written after an audit of the dormant v1 codebase. File references and the known-bug list
are in [`AGENTS.md`](../AGENTS.md). The phases are ordered so each one stands on the one
before. Inside a phase, items are roughly in priority order.

| Phase | Theme | Why this order |
|---|---|---|
| 0 | Stabilize | Can't safely change scoring/selection without tests and a working map |
| 1 | Maps fix | The game is unplayable-looking without tiles |
| 2 | Mobile, bulletproof | Most players are on phones; every later feature renders inside this layout |
| 3 | Scoring v2 | Region-aware scoring; pure function, easy to test and tune |
| 4 | Daily selection v2 + seed list v2 | Changes everyone's daily game, so ship with a cutover date |
| 5 | Engagement | Streaks, archive, stories, PWA |
| 6 | Content expansion | More museums, themed days |

---

## Phase 0: Stabilize (≈ ½ day)

Done:
- [x] Lockfile drift fixed (`npm ci` failed before this revival commit).
- [x] **Vitest** with unit tests for `src/lib/*`: score table, medals, `getDailyObjects`
      golden output (pins determinism), day number, share text, storage, tile config.
- [x] `npm run lint` at zero: per-round components are keyed instead of resetting state in
      effects; the unused geocode helpers are marked for Phase 4; `persist` deps fixed.
- [x] Correctness bugs: `submitTimeout` → `persist`; one layout mounted (one Timer); hint
      cost label uses `HINT_PENALTY`; "Perfect" → "Curator"; seed fetch errors show a retry
      screen; Met requests time out after 8 s; honest clipboard fallback; share text uses
      stolen-antiquities.com.
- [x] GitHub Action: `npm ci && npm run lint && npm test && npm run build`.

## Phase 1: Fix the map

**Diagnosis (confirmed):** the tiles were keyless CARTO Positron, and CARTO now watermarks
keyless tiles with "API KEY REQUIRED".

Done:
- [x] Tile config centralized in `src/lib/map-tiles.ts` plus `<BaseTileLayer />`, which
      also holds the Leaflet icon fix.
- [x] Switched to **Stadia Alidade Smooth** (style selectable via `VITE_MAP_STYLE`).
- [x] Sepia filter moved to the tile pane, and the map container is isolated.
- [x] Automatic OSM fallback after repeated tile errors.
- [x] Met requests time out (8 s).

**Owner action:** register `stolen-antiquities.com` in the Stadia dashboard
("Manage Properties" → Authentication Configuration). Until then, production gets 401s and
runs on the OSM fallback.

Remaining:
- [ ] Try `stamen_toner_lite` and `stamen_watercolor` on the real site and pick a favourite.
- [ ] Retry `null` Met objects when the round starts.
- [ ] Snapshot Met metadata into the seed file at build time (below).

Original options considered, for reference:

1. Centralize the tile config (done).
2. **Pick a provider.** Options, in order of recommendation:
   - **Stadia Maps, Stamen Watercolor or Toner Lite.** Watercolor fits the "paper map on a
     desk" art direction perfectly, and Toner Lite is the clean option. Free tier for
     non-commercial use; web apps authenticate by **domain allowlist**, so no key ships in
     the bundle. Localhost works without auth.
   - **CARTO with a free key.** Smallest change (same look). The free tier is for
     non-commercial use. CARTO is reportedly retiring raster basemaps in favour of vector,
     so treat this as a stopgap.
   - **OpenFreeMap / MapTiler (vector).** Good long-term, but needs MapLibre GL (or
     `@maplibre/maplibre-gl-leaflet`), which is a bigger change and a heavier bundle.
   - Avoid the raw `tile.openstreetmap.org` servers for production; their usage policy
     discourages it.
3. (done) **Apply the sepia filter to `.leaflet-tile-pane` only**, not `.leaflet-container`. That
   keeps the pins and controls their true colors and removes the stacking-context trap
   (see Phase 2).
4. (done) Add a **tile-error fallback**: on `tileerror` past a threshold, swap to a secondary
   provider and log it.
5. While here, make the Met side more robust:
   - Add a fetch timeout (AbortController, ~8 s).
   - Retry `null` objects when the round starts.
   - **Snapshot the Met metadata into the seed file at build time** (title, date, medium,
     department, creditLine, image URLs) so gameplay doesn't depend on the Met API, only
     on the image CDN. That also removes the 10-request burst on load.

## Phase 2: Mobile, bulletproof

Goal: one thumb, a 375 px wide phone, bad network, and nothing ever overlaps or gets stuck.

Done:
- [x] **One layout mounted.** Phone portrait is a column (HUD bar → map → sheet); desktop
      and phone landscape (`max-height: 500px`) use the side panel. Rotating keeps the map
      mounted.
- [x] **Sheet in normal flow**, not floating over the map. It has two states (peek and
      open, at most 46 dvh), toggles by tap or swipe on a 44 px handle, opens for each new
      object, and collapses on any map touch and at the reveal. The map resizes with it
      without shifting under the finger.
- [x] Compact sheet content: the image is contained (nothing cropped), hints sit side by
      side, and the round counter moved to the HUD.
- [x] The zoom control is no longer covered. Credits sit on the bottom edge, and the
      Confirm button and reveal card are lifted above them. Reveal fitting keeps both pins
      clear of the card, and fits the answer even when there was no guess.
- [x] Each round starts with the whole world in view (fractional zoom, `zoomSnap 0.25`).
- [x] Double-tap zoom is off on touch screens (it also dropped a pin).
- [x] The image modal is portalled above everything, closes on Escape, and has a 44 px
      close button. Broken images show "Image unavailable" instead of shimmering forever.
- [x] Safe areas (`viewport-fit=cover`) on every screen; `theme-color`; no
      pull-to-refresh during play; no tap highlight flash.
- [x] **State resilience:** `startedAt` and `pendingGuess` are saved, so a reload resumes
      the countdown and keeps the pin. **A pin left on the map when time runs out is now
      scored** (per the GDD) instead of counting as lost.
- [x] Next object's image is prefetched.
- [x] Results: the map is locked on touch screens until tapped (no scroll trap). Phones
      get the native share sheet, with clipboard and select-text fallbacks. Larger "Back
      to start" target.
- [x] Compact splash on short screens, so Begin is visible in landscape.
- [x] **Playwright suite** (`npm run test:e2e`, CI job) on 7 sizes from a 280 px Fold to
      desktop, asserting nothing important is covered, nothing overflows sideways, the
      sheet behaves, and reload and timeout behave.

Remaining:
- [ ] **Real-device pass** on iOS Safari and Android Chrome. The suite runs Chromium with
      device viewports, so it can't catch Safari-specific behaviour (the address bar
      resizing `dvh`, rubber-banding, `navigator.share` quirks).
- [ ] Android back button: it currently leaves the site (progress is saved). Consider
      `history.pushState` per round, or back-to-close for the image modal.
- [ ] Sheet follows the finger while dragging (it currently snaps on release).
- [ ] Optional: draggable pin for fine adjustment; haptic tick on pin drop.
- [ ] Lighthouse mobile ≥ 90; preload fonts.

## Phase 3: Scoring v2 (region-aware)

**Problem.** One global curve: full points within 400 km, near zero by 2000 km. In Europe,
400 km spans several countries (Paris → Brussels is ~260 km, a full-points "win" in the
wrong country). In China, India or the Pacific, a 900 km miss is a decent guess but scored
~408.

Done (game dates from `SCORING_V2_START`, **2026-11-01**; earlier dates keep v1, so all
players on one day share the same rules):
- [x] **Per-object scale `scaleKm`**, computed in the seed pipeline by
      `src/lib/region-scale.ts`: `clamp(round50(1.7 × mean distance to the 5 nearest other
      UN-member country centres), 700, 2200)`. The nearest centre is skipped as "probably
      the answer's own country". Centres come from the `world-countries` dev dependency
      (ODbL); only the derived numbers ship. `SCALE_OVERRIDES` in the pipeline allows
      hand-tuning per object.
- [x] **Curve**, with x = distance / scaleKm: full points for x ≤ 0.25, then
      `1000·(1 − (x−0.25)/2.75)³`, reaching 0 at x = 3.
- [x] **Medals follow the scale**: `curator` x ≤ 0.25, `close` x ≤ 1, `distant` beyond.
- [x] **Legible on the reveal**: a gold disc (full points) and a dashed ring ("close")
      around the answer, and the card says "Full points within N km for this object".
- [x] Regenerating the seed list only *added* `scaleKm`; order and contents are
      unchanged, so daily selection is unaffected (the golden test pins it).

Where it landed (scale medians by region: Europe 700, Middle East/North Africa 1300,
sub-Saharan Africa 1100, South/East Asia 2175 → capped at 2200, Americas and Oceania 2200):

| Points for a miss of… | scale | full ≤ | 250 km | 500 km | 1000 km | 2000 km |
|---|---|---|---|---|---|---|
| v1 (everywhere) | — | 400 | 1000 | 844 | 335 | 29 |
| Paris, Rome | 700 | 175 | 888 | 574 | 187 | 0 |
| Court of Benin | 1050 | 265 | 1000 | 773 | 413 | 63 |
| Isfahan, Mesoamerica | 1300 | 325 | 1000 | 860 | 534 | 150 |
| Thebes (Luxor) | 1550 | 390 | 1000 | 923 | 628 | 240 |
| Beijing, Kyoto, Java, Peru | 2200 | 550 | 1000 | 1000 | 793 | 440 |

Known trade-offs:
- The centroid heuristic can't tell a sea from a border: Japan gets the same loose scale
  as China, so guessing Korea for a Japanese object still scores well. Use
  `SCALE_OVERRIDES` for cases like that.
- Europe is now noticeably harder, and it's ~45% of today's pool, so average daily
  scores will drop until Phase 4 rebalances the pool.

Remaining / ideas:
- [ ] Playtest, then tune `SCALE_FACTOR`, the 700/2200 bounds, and the cubic tail.
- [ ] Optional **right-country bonus**: lazy-load Natural Earth 110 m admin-0 and run
      point-in-polygon on the guess; landing in the answer's modern country sets a score
      floor (e.g. 600). Ancient cultures cross modern borders, so allow
      `acceptCountries: [...]` per seed.
- [ ] Hints: consider a percentage penalty (−15% per hint) instead of a flat −75, so
      hints cost the same relative amount everywhere.
- [ ] Release note: "new scoring from #245", so day-over-day comparisons aren't confusing
      (history stores plain numbers, so nothing breaks).

## Phase 4: Daily selection v2 and seed list v2

**Problems today**
- `getDailyObjects` reshuffles the whole pool every day. Objects can repeat on consecutive
  days, and nothing balances geography: with ~45% of the pool in Europe, many days are
  Euro-heavy, and some have several answers at the exact same coordinate (16 objects sit
  on Thebes and 16 on central London).
- The pool is small (283, so a repeat is guaranteed within a month) and skewed, because
  `isGameplayRelevant()` was never wired in.

**Selection algorithm: "stratified decks"** (deterministic and stateless)
1. In the pipeline, tag each seed with a **zone** (~8 macro-regions: Western Europe,
   Mediterranean & Near East, Egypt & North Africa, Sub-Saharan Africa, South & Central
   Asia, East Asia, SE Asia & Oceania, the Americas).
2. For each zone, build a **seeded permutation** of its objects (`seed = hash("v2:" + zone)`)
   and treat it as a cyclic deck.
3. A **daily template** says how many slots each zone gets (10 slots, 8 zones: every zone
   gets 1, and 2 zones get a second slot, rotating by day number). Day *N* deals the next
   cards from each zone's deck, so nothing repeats until that zone's deck cycles.
4. **Constraints with deterministic swap-forward:** at most 2 per modern country, at most 3
   per department, no two answers within 300 km of each other. If a card violates a
   constraint, take the next card in that deck instead.
5. **Order the round:** easy openers, a hard closer, and alternating hemispheres where
   possible, so consecutive rounds feel different.
6. **Versioning:** `SELECTION_V2_START = "YYYY-MM-DD"` (a future date). Dates before it use
   the v1 function unchanged, so archive mode (Phase 5) and shared results stay
   reproducible. Golden-output tests pin both versions.

**Seed list v2**
- Wire in `isGameplayRelevant()`. Drop the Libraries and European instruments where the
  "origin" is just a workshop city.
- Widen the funnel beyond `Is Highlight`: public-domain objects with an image,
  `Geography Type` in {Made in, From, Excavated at, Found}, and city- or region-level
  geography. Target **800–1500** objects, with zone quotas so no zone is over ~20%.
- Add a `zone`, `scaleKm`, `acceptCountries`, and (from Phase 1) a snapshotted metadata
  block per object.
- Add a small **review tool**: a local dev page listing candidates with image, metadata
  and a mini-map, plus keep/reject/move-pin buttons, writing to `curation-overrides.json`
  that the pipeline merges in. Hand review is what makes the answers trustworthy.
- Jitter or de-duplicate stacked coordinates. Where the data allows, prefer
  site-specific coordinates (Deir el-Bahri, not "Thebes") for famous sites.

## Phase 5: Engagement

- **How-to-play** first-run modal (3 panels), and an explanation of the scoring zone.
- **Stats and streaks:** games played, current/max streak, average score, a distribution
  histogram, and a medal cabinet. Everything is already in `localStorage` history.
- **Archive mode:** play any past day (selection is deterministic). Mark those games
  as archive so they don't count toward streaks. This replaces "practice replays today".
- **Object story after each reveal.** The "stolen" angle is the hook: show
  `creditLine` and `accessionYear` ("Acquired by the Met in 1926 — Rogers Fund"), a
  one-line provenance blurb, and a link to the Met page. A Wikidata link is available in
  the CSV.
- **Share card image** (OG image or canvas-rendered PNG of the medal grid and mini-map)
  plus `navigator.share`.
- **PWA:** manifest, icons, offline shell, today's set pre-cached, "Add to Home Screen".
- **Privacy-friendly analytics** (Plausible or Umami) to see which objects people miss.
  That's the best input for difficulty tuning.
- **Accessibility:** keyboard pin placement (arrow keys move a crosshair, Enter
  confirms), screen-reader text for distances and medals, reduced-motion support, and a
  colour-blind-safe alternative to red vs green pins.

## Phase 6: Content expansion

- More open-access collections with usable geography: the **Cleveland Museum of Art**
  (CC0 API, good `culture`/`find_spot` data), the **Art Institute of Chicago**, the
  **Rijksmuseum**, and the **Smithsonian** (Open Access API, needs a key).
  Normalize everything into the same seed schema with a `source` field.
- **Themed days** (Silk Road week, "Objects from Africa", Repatriated objects) using the
  same zone-template mechanism.
- **Difficulty modes**, or a weekly "hard Sunday".
- Longer-term (needs a backend): leaderboards, friends' scores, server-side answers
  (anti-cheat).

---

## Open questions for the owner

1. ~~What's broken on the map?~~ The CARTO watermark. Fixed in Phase 1.
2. ~~Commercial?~~ No, so the free Stadia tier fits.
3. Should the timer stay at 30 s on mobile? Pinch-zoom costs time; 40 s on touch devices
   is an option.
4. ~~Domain?~~ stolen-antiquities.com; the share text now uses it.
