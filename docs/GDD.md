# Stolen Antiquities — Game Design Document

> A daily geography-guessing game where players return Metropolitan Museum objects to their place of origin on a world map.

---

## 1. Concept

**Elevator pitch:** "GeoGuessr meets art history." Each day, players are shown 10 objects from the Metropolitan Museum of Art's collection. For each object, the player studies the photo and available metadata, then drops a pin on a world map where they believe the object originated. Scoring is distance-based — closer is better. Hints are available but cost points. A per-object countdown keeps the pace brisk. After all 10, players get a summary score and can share their results Wordle-style.

**Target platform:** Mobile-first responsive web app (single URL, no install).

**Tone:** Smart-casual. Museum-quality imagery with playful, encouraging UI copy. Educational but not stuffy — closer to a pub quiz than a lecture.

**Inspirations:** Wordle (daily ritual, shareable scores), GeoGuessr (map-based guessing), Sporcle (trivia with a timer).

---

## 2. Core Loop

```
For each of the 10 objects:
  1. PRESENT  → Show object image, title, and date. Timer starts (30s).
  2. HINT     → Player may reveal hints (costs points). See §4.
  3. PLACE    → Player pans/zooms the map and drops a pin.
  4. REVEAL   → Show correct location, draw line, display distance & points earned.
  5. NEXT     → Advance to next object. After object 10, go to Results.
```

If the timer expires before placement, the object is scored as 0 points (max distance penalty) and the reveal is shown.

---

## 3. Scoring

### Distance-based formula

Points are awarded per object on a **1,000-point scale**, inversely proportional to distance:

| Distance from origin | Points |
|---|---|
| ≤ 50 km | 1,000 (Perfect) |
| 50–250 km | 900–750 (linear interpolation) |
| 250–1,000 km | 750–400 |
| 1,000–5,000 km | 400–100 |
| > 5,000 km | 100–0 |
| Timer expired (no guess) | 0 |

*Exact curve TBD during playtesting. The above tiers are a starting framework — implementation should use a continuous decay function (e.g., exponential decay) rather than hard tiers, with these values as guideposts.*

**Max possible score:** 10,000 (10 × 1,000).

### Hint penalty

Each hint used on an object reduces that object's maximum possible score by a flat amount. See §4 for details.

### Medals (per object)

| Medal | Requirement |
|---|---|
| 🏛️ Curator | ≤ 50 km |
| 🎯 Close | ≤ 250 km |
| 🌍 Continent | Correct continent |
| ❌ Lost | > 5,000 km or timed out |

---

## 4. Hint System

Each object has up to **3 progressive hints**, revealed one at a time. Each hint deducts **150 points** from that object's max score (so using all 3 caps the object at 550 max).

| Hint level | Information revealed | Cumulative cost |
|---|---|---|
| Hint 1 | **Culture / region** (e.g., "Edo period, Japan") | −150 |
| Hint 2 | **Medium / materials** (e.g., "Woodblock print, ink on paper") | −300 |
| Hint 3 | **Department** (e.g., "Asian Art") + acquisition notes | −450 |

Hint content is pulled directly from Met API object fields (see §8). If a field is empty for a given object, skip to the next available hint — the player should always get meaningful new information per tap.

---

## 5. Timer

- **30 seconds per object.** Countdown is visible at all times.
- Timer starts when the object is presented (after any transition animation).
- Requesting a hint does **not** pause or reset the timer.
- At **10 seconds remaining**, the timer visually pulses / changes color as a warning.
- At **0 seconds**, if no pin has been placed:
  - The round auto-submits with 0 points.
  - The correct answer is revealed normally.
  - The object is marked as "Timed out" on the results screen.

---

## 6. Daily Challenge

### How it works

- One set of 10 objects per calendar day (midnight UTC rollover).
- Every player worldwide gets the same 10 objects in the same order.
- Players get **one attempt per day** (tracked via `localStorage`; no server auth for v1).
- After completing or abandoning a game, the player sees Results and cannot replay until the next day.

### Object selection strategy (v1)

For the proof of concept, daily objects are selected from a **curated seed list** of ~200 pre-vetted Met objects (see §8 for curation criteria). A deterministic pseudo-random function seeded with the date (e.g., `hash(YYYY-MM-DD)`) selects 10 from this list each day.

*This avoids needing a backend while ensuring every player gets the same set. The seed list is shipped as a static JSON file.*

### Curation criteria for the seed list

Objects must:

1. Have an Open Access image (`isPublicDomain: true`).
2. Have a **reliable geographic origin** — either coordinates in the API or an unambiguous culture/country field that can be geocoded to a specific point.
3. Be visually interesting at thumbnail scale (no fragments, no text-only items).
4. Represent geographic diversity — the seed list should cover all inhabited continents.
5. Span a range of difficulty — some immediately recognizable (Egyptian sarcophagus), some tricky (Cypriot pottery that could be Greek).

---

## 7. Results & Sharing

### Results screen

After all 10 objects, display:

- **Total score** out of 10,000.
- **Per-object breakdown:** thumbnail, object title, distance, points, medal, hints used.
- **Summary stats:** average distance, best/worst object, hints used.
- **Map overview:** all 10 correct locations shown, with lines from each player guess.

### Shareable score card

A Wordle-style text block the player can copy to clipboard:

```
🏛️ Stolen Antiquities #142 — 7,450/10,000

🏛️🎯🌍🏛️❌
🎯🏛️🌍🎯🏛️

⏱️ 3 hints used
stolenantiquities.app
```

Each emoji corresponds to one object's medal (in order). The format is two rows of 5.

---

## 8. Data & Content

### Source: Met Museum Open Access API

- **Base URL:** `https://collectionapi.metmuseum.org/public/collection/v1`
- **Key endpoints:**
  - `/objects/[id]` — returns full metadata for one object.
  - `/search?isHighlight=true&hasImages=true&q=*` — useful for finding high-quality candidates.
- **Relevant fields per object:**

| Met API field | Game usage |
|---|---|
| `primaryImage` | Main display image |
| `title` | Shown to player |
| `objectDate` | Shown to player (e.g., "ca. 1350–1300 B.C.") |
| `culture` | Hint 1 |
| `medium` | Hint 2 |
| `department` | Hint 3 |
| `creditLine` / `accessionYear` | Hint 3 (supplemental) |
| `country`, `region`, `city` | Used to determine correct answer coordinates |
| `GalleryNumber` | Not used in gameplay |

### Geocoding the "correct answer"

The Met API does not provide lat/lng coordinates. Origin coordinates must be **manually assigned during seed list curation**. For each object in the seed list, the curator (you) determines the most accurate origin point based on the `country`, `region`, `city`, and `culture` fields, then stores a `[lat, lng]` pair in the seed list JSON.

Example seed list entry:

```json
{
  "objectID": 45734,
  "lat": 25.7402,
  "lng": 32.6014,
  "difficulty": "easy",
  "notes": "Temple of Hatshepsut, Luxor — strong visual cues"
}
```

The rest of the metadata (title, image URL, hints) is fetched from the Met API at runtime using the `objectID`.

---

## 9. Map Interaction

### Library: Leaflet.js + OpenStreetMap tiles

- **Tile provider:** OpenStreetMap (free, no API key). Consider CartoDB Positron or Stamen Toner for a cleaner aesthetic.
- **Initial view:** World view, centered roughly on [20, 0] at zoom level 2.
- **Interaction:**
  - Player pans and zooms freely (scroll, pinch, drag).
  - **Tap/click to place pin.** Pin can be repositioned by tapping elsewhere before confirming.
  - A **"Confirm placement"** button locks in the guess and triggers the reveal.
  - On mobile, the map should take up the majority of the viewport. Object image and hints live in a collapsible panel at the top or bottom.

### Reveal animation

After confirmation:

1. Correct location pin drops onto the map (distinct color/style from player pin).
2. A line (great-circle arc) draws between the two pins.
3. Distance (in km) and points animate in.
4. Brief pause (~2s), then "Next object →" button appears.

---

## 10. UI / Screen Flow

```
[Splash / Title Screen]
  └─→ [Daily Challenge Start]  (shows date, "10 objects to return")
        └─→ [Game Screen]  ← repeats 10 times
        │     ├── Object panel (image, title, date, hint buttons)
        │     ├── Timer bar (30s countdown)
        │     └── Map (full interaction)
        │           └── [Confirm] → [Reveal overlay on map]
        │                              └── [Next →]
        └─→ [Results Screen]
              ├── Score summary
              ├── Per-object breakdown (scrollable)
              ├── Map overview
              └── [Share] [Play again tomorrow]
```

### Responsive layout

- **Desktop (≥1024px):** Side-by-side — object panel on the left (~350px), map fills remaining space.
- **Tablet (768–1023px):** Object panel as a top bar (collapsible), map below.
- **Mobile (<768px):** Object panel as a bottom sheet (draggable, shows image + title when collapsed, full hints when expanded), map fills the screen behind it.

---

## 11. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **React + TypeScript** | Vite for build tooling |
| Map | **Leaflet.js** + **React Leaflet** | Free, no API key. OSM tiles. |
| Tile provider | **OpenStreetMap** or **CartoDB Positron** | Positron has a cleaner, muted look that lets the pins pop |
| Styling | **Tailwind CSS** | Utility-first, fast iteration |
| Data (objects) | **Met Museum Open Access API** | Runtime fetch per object |
| Data (seed list) | **Static JSON** in repo | ~200 curated objects with coordinates |
| Daily seed | **Deterministic hash** of date string | e.g., simple modular hash to pick 10 from seed list |
| Persistence | **localStorage** | Tracks daily completion, streak, stats |
| Hosting | **Vercel** | Free tier, zero config for Vite/React |
| Analytics (optional) | **Plausible** or none | Privacy-friendly, lightweight |

### No backend required for v1

All game logic runs client-side. The seed list is static. Daily selection is deterministic. Player state is in localStorage. The Met API is public and free.

---

## 12. Future Considerations (Out of Scope for v1)

These are explicitly **not** in the v1 build but are worth keeping in mind architecturally:

- **Freeplay mode** — random objects from the full seed list (or expanded list), no daily constraint.
- **Difficulty tiers** — easy/medium/hard toggles that filter the seed list.
- **Expanded seed list** — grow from 200 to 1,000+ objects; potentially automate curation with scripts that filter the Met API for objects with strong geographic metadata.
- **Multiplayer** — real-time head-to-head or async leaderboards (would require a backend).
- **Other museum APIs** — Rijksmuseum, Smithsonian, British Museum, etc.
- **Streaks & stats** — persistent stats page (games played, avg score, best score, current streak).
- **Accessibility** — screen reader support for the map interaction, keyboard navigation.
- **Object "story" after reveal** — short blurb about the object's history and provenance after each round.

---

## 13. Open Questions

1. **Title tone:** "Stolen Antiquities" is the name — it's provocative and memorable, leaning into the real-world debate around museum collections. UI copy and marketing should match this irreverent energy without being preachy.
2. **Timer tuning:** 30 seconds is a starting point. Playtesting may reveal this is too tight (especially on mobile with map zoom) or too generous.
3. **Hint content fallback:** Some Met objects have sparse metadata. The seed list curation should filter these out, but a fallback strategy is needed if a hint field is empty at runtime.
4. **Image loading:** Met API images can be large. Consider lazy-loading a thumbnail first, with a tap-to-zoom for the full-res image.
5. **Anti-cheat:** With client-side logic and a static seed list, a determined player could inspect the JSON to find answers. Acceptable for v1 — not worth solving until there's a leaderboard.
