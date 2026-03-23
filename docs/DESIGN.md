# Stolen Antiquities — Design Direction

> This document is the authoritative source for visual and interaction design decisions. Reference it before writing any UI code.

---

## Visual Metaphor

**A paper map on a desk, with research papers laid on top.**

The player is a researcher trying to figure out where to repatriate museum objects. The map feels like a worn, sepia-toned paper map spread across a table. UI panels (object info, hints, results) feel like paper documents, index cards, or dossier pages layered on top of the map. The overall impression is scholarly but tactile — a working surface, not a museum exhibit.

---

## Typography

**Serif-forward. Scholarly, newsprint-adjacent, but digitally legible.**

- **Headings / display:** A high-contrast serif with editorial character. Candidates (in order of preference):
  - `DM Serif Display` — warm, high-contrast, excellent at display sizes
  - `Playfair Display` — classic editorial feel
  - `Libre Baskerville` — more restrained, very legible
- **Body / UI text:** A readable serif for running text and labels:
  - `Source Serif 4` — designed for screens, excellent readability at small sizes
  - `Libre Baskerville` — if using a different display font
- **Monospace / data (scores, distances, timer):**
  - `JetBrains Mono` or system monospace — for the timer, scores, and distance readouts. Gives a utilitarian, instrument-panel contrast against the serif.

All fonts loaded via Google Fonts. Keep the load to 2-3 families max.

---

## Color Palette

### Base tones — muted, warm, papery

| Token | Hex | Usage |
|-------|-----|-------|
| `cream` | `#F5F0E8` | Page background, card backgrounds |
| `cream-dark` | `#EBE4D6` | Secondary surfaces, hover states |
| `parchment` | `#E6DFD1` | Object panel background, bottom sheet |
| `sepia` | `#D4C5A9` | Map overlay tint, borders, dividers |
| `sepia-dark` | `#B8A88A` | Muted text, secondary labels |
| `ink` | `#2C2416` | Primary text — warm near-black |
| `ink-light` | `#5C4F3A` | Secondary text, captions |

### Map

- Tile style: Use a sepia/muted tile set. CartoDB Positron as the base, with a CSS filter applied to the map container to warm and desaturate it:
  ```css
  .leaflet-container {
    filter: sepia(0.3) saturate(0.85) brightness(1.02);
  }
  ```
  This shifts the cool grey Positron tiles toward a warm, paper-map feel.

### Accent — vibrant red (the one pop of color)

| Token | Hex | Usage |
|-------|-----|-------|
| `red` | `#E63B2E` | Player pin, guess marker |
| `red-bright` | `#FF4136` | Dotted path line between guess and answer |
| `red-dark` | `#B22D23` | Red hover/active states |

The red is intentionally vibrant against the muted palette — it's the color of a pushpin stuck into a paper map, or red ink marking a location on a dossier.

### Correct-answer green

| Token | Hex | Usage |
|-------|-----|-------|
| `green` | `#4A7C59` | Correct location pin — muted, archival green |
| `green-light` | `#5E9E72` | Green hover states |

The green is deliberately less saturated than the red — the player's guess is the hero, the answer is the resolution.

### Scoring / feedback

| Token | Hex | Usage |
|-------|-----|-------|
| `gold` | `#C8A951` | Perfect score, curator medal, star moments |
| `amber` | `#D4920B` | Warnings, timer ≤10s state |

---

## Interaction & Animation

### Core principle: snappy with easing, never sluggish

All animations should feel **fast but not instant** — the player should sense motion without waiting for it. Target durations:

| Element | Duration | Easing |
|---------|----------|--------|
| Bottom sheet open/close | 200–250ms | `ease-out` (opening), `ease-in` (closing) |
| Panel slide transitions | 200ms | `ease-out` |
| Pin drop (on placement) | 300ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight bounce) |
| Reveal line draw | 600–800ms | `ease-in-out` (line grows from guess to answer) |
| Score counter | 400ms | `ease-out` (numbers count up) |
| Screen transitions | 250ms | `ease-out` fade or slide |
| Hint reveal | 150ms | `ease-out` (fade in + slight slide up) |

### Drawers & sheets
- Bottom sheet (mobile object panel): drag handle, spring-physics feel on drag, snaps to collapsed/expanded positions. Fast open/close — 200ms max.
- Collapse/expand: never blocks interaction. Map remains touchable even while sheet animates.

### Map interaction
- Drag to pan, pinch/scroll to zoom — standard Leaflet behavior, no custom overrides.
- **Tap to place pin.** Pin appears with a quick drop animation (slight bounce). Tapping elsewhere moves it with a short slide (150ms).
- Pin should feel like sticking a pushpin into paper — quick, decisive.
- On reveal: the dotted line draws itself from guess to answer over ~700ms, like ink tracing a path on a map.

### Drag-and-drop
- Where feasible, allow drag-based interaction as an alternative to tap. E.g., the player could drag the pin from a fixed position to the map location rather than only tapping.
- Drag feedback: slight scale-up (1.1x) and shadow on the dragged element.

---

## Component Feel

### Object panel / cards
- Paper-like: cream background, subtle `box-shadow` (soft, warm-toned), slightly rounded corners (4-6px).
- Optional: very subtle paper texture via CSS noise or a light background image. Keep it subtle — it should feel textured, not themed.
- Borders: use `sepia` tone, thin (1px), not harsh.

### Buttons
- Primary action ("Confirm Placement", "Start", "Next"): `ink` background, `cream` text, slight rounded corners. On hover: subtle lift (translate-y -1px + shadow increase).
- Secondary/hint buttons: `cream-dark` background, `ink` text, bordered.
- Share button: `red` background, white text — the one loud CTA on the results screen.

### Timer
- Displayed as a horizontal bar that depletes, or a numeric countdown.
- Default state: `ink-light` color, calm.
- ≤10 seconds: transitions to `amber`, gentle pulse (scale 1.0 → 1.02, repeating).
- ≤5 seconds: `red`, faster pulse.

### Results screen
- Feels like a graded dossier. Per-object rows look like entries in a research log.
- Map overview: all pins visible, red dotted lines from each guess to each answer. The full picture of the player's session.
