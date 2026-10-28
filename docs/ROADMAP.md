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

**Layout architecture**
- Render **one layout**, not both. Use a `useMediaQuery` hook (or a `matchMedia`-backed
  `useLayout()`) and mount either the desktop panel or the mobile sheet. That fixes the
  double timer and double image load.
- Mobile game screen as a **3-row grid**: `[timer/HUD] [map 1fr] [sheet]`. Make the sheet a
  real row instead of a `fixed` overlay, so the Confirm button and reveal card are placed
  relative to the visible map and can't collide with the sheet.
- **Sheet states:** `peek` (thumbnail + title, ~88 px + safe area), `half` (~45 dvh: image
  + hints), `full` (image focus). Start each round at `half`; auto-drop to `peek` on the
  first map `movestart`/`zoomstart`/tap. Support a **drag gesture** (pointer events with
  velocity snap; no library needed) as well as tap on the handle (min 44 px hit area).
- **Phone landscape** (`(orientation: landscape) and (max-height: 500px)`): use the side
  panel layout at ~40% width with a compact image.

**Overlap and z-index**
- With the filter moved to the tile pane (Phase 1), there's one z-index scale in
  `index.css`: map 0 < map controls 400 < HUD 500 < sheet 600 < reveal 700 < modal 900.
- Move the zoom control to `bottomright` on mobile, or hide it (pinch is enough), so the
  HUD stops covering it.
- Render the image modal through a **portal** to `document.body`. Close it on Escape and
  on back gesture (`history.pushState` and `popstate`).

**Safe areas and viewport**
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Pad the HUD with `env(safe-area-inset-top)`, the sheet and bottom buttons with
  `env(safe-area-inset-bottom)`, and the sides in landscape.
- Keep using `dvh`. Also add `overscroll-behavior: none` on the game screen, to stop
  pull-to-refresh and rubber-banding mid-pan.

**Touch interaction**
- **Tap vs pan vs double-tap.** Only place a pin on a `click` that wasn't part of a drag,
  and debounce it ~250 ms so a double-tap zoom doesn't also move the pin. Alternatively,
  show a draggable pin after the first tap so fine-tuning doesn't need precise re-taps.
- Big Confirm button (min 48 px tall), full width inside the map's bottom area, with haptic
  `navigator.vibrate(10)` where supported.
- **Results overview map:** disable `dragging` and `tap` on touch until the user taps it
  (a "Tap to explore" scrim) or uses two fingers. This removes the scroll trap.

**State resilience**
- Persist the **round start timestamp** and pending pin. On resume, the timer continues
  from where it was (it doesn't reset to 30 s), and an expired round resolves immediately.
- Handle `visibilitychange`/`pagehide` so state is saved when iOS kills the tab.
- **Prefetch the next round's image** during the reveal (`new Image().src = …`) and
  decode it before showing. Use `primaryImageSmall` in the panel and full-res only in the
  modal.

**Sharing**
- Use **`navigator.share`** on mobile (native share sheet), falling back to the clipboard,
  then to selecting the `<pre>`. Only show "Copied!" when it actually worked.

**Verification (make it repeatable)**
- Playwright project with device profiles: iPhone SE (375×667), iPhone 15 (393×852),
  Pixel 7 (412×915), Galaxy Fold folded (~280 wide), phone landscape, iPad.
  - Stub the Met API and tiles with fixtures, play a full game scripted, screenshot each
    phase, and assert no overlap: the Confirm button's bounding box doesn't intersect the
    sheet, and the HUD doesn't intersect the zoom control.
- Real-device pass on iOS Safari and Android Chrome. Watch for the address bar
  collapsing/expanding mid-round.
- Lighthouse mobile ≥ 90. Fonts: preload, plus a `font-display: swap` fallback stack.

## Phase 3: Scoring v2 (region-aware)

**Problem.** One global curve: full points within 400 km, near zero by 2000 km. In Europe,
400 km spans several countries (Paris → Brussels is ~260 km, a full-points "win" in the
wrong country). In China, India or the Pacific, a 900 km miss is a decent guess but scores
~408.

**Proposal: a per-object scale `s` (km), with the existing curve shape normalized to it.**

```
x = distance / s
score = 1000                         if x ≤ 0.25
      = 1000 · (1 − (x−0.25)/2.25)^p  if x ≤ 2.5     (p ≈ 4, softer than today's 6)
      = 0                            otherwise
```

With `s = 1600, p = 6`, this reproduces today's curve exactly, so it's a safe superset.

**How to choose `s`.** Make it reflect how *crowded with plausible alternatives* the
neighbourhood is, not how big the country is:

- ❌ *sqrt(country area)* is tempting but wrong. It makes Japan and the Solomon Islands as
  harsh as Germany, even though nothing else plausible is nearby. (Tested: it gives Japan
  and Solomon Islands 284 points at 600 km, the same as Germany.)
- ✅ **Neighbour-density radius**, computed offline in the pipeline: `s = clamp(k · mean
  distance from the answer to the 3 nearest *other-country* centroids, 600, 2600)`.
  Europe lands around 600–800, East Asia and the Pacific 1800–2600, the Americas and MENA
  in between. Store `scaleKm` in each seed entry so the runtime stays trivial and it can be
  hand-overridden per object.
- Ship a script that prints, for every seed, the points at 250/500/1000/2000 km misses, so
  tuning happens by reading a table instead of playing 50 games.

**Make it legible to players.** On reveal, draw a faint circle at the full-points radius
(`0.25·s`) and another at the "close" radius around the answer. Players then *see* that
the target zone in Asia is bigger, and the scoring feels fair, not arbitrary.

**Optional layer: a right-country bonus.** Lazy-load Natural Earth 110 m admin-0
(`world-atlas/countries-110m.json`, ~100 KB TopoJSON) and run point-in-polygon on the
guess. If the guess lands in the same modern country as the answer, set a score floor
(e.g. 600) and show "Right country". The caveat is that ancient cultures don't map to
modern borders (Mesopotamia ≈ Iraq + Syria + Turkey), so allow `acceptCountries: [...]` per
seed.

**Medals** should follow the scale too: `curator` x ≤ 0.25, `close` x ≤ 1.0 (or right
country), `distant` > 1.0. Fix the "Perfect" label.

**Hints.** Pick one number and use it in the UI and the scoring. Consider a *percentage*
penalty (−15% per hint) so hints cost the same relative amount at any distance.

**Compatibility.** Scores in history were computed with v1, which is fine: they're stored
as numbers. Mention "new scoring" in the release note so day-over-day comparisons aren't
confusing.

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
