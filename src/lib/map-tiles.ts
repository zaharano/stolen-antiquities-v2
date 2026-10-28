// Base map tile providers. Both maps (game and results) read from here.
//
// Primary: Stadia Maps. Free for non-commercial use. Browsers authenticate by
// domain: register the production domain under "Manage Properties" in the
// Stadia dashboard. localhost works without any setup. Without a registered
// domain (or API key) tiles return 401 and the map falls back to OSM.

export interface TileProvider {
  url: string
  attribution: string
  maxZoom: number
}

// Credit links open in a new tab so a stray tap on the map doesn't leave the game
const link = (href: string, text: string) =>
  `<a href="${href}" target="_blank" rel="noopener">${text}</a>`

const OSM_ATTRIBUTION = `&copy; ${link("https://www.openstreetmap.org/copyright", "OpenStreetMap")} contributors`
const STADIA = `&copy; ${link("https://stadiamaps.com/", "Stadia Maps")}`
const OPENMAPTILES = `&copy; ${link("https://openmaptiles.org/", "OpenMapTiles")}`
const STAMEN = `&copy; ${link("https://stamen.com/", "Stamen Design")}`

const STADIA_ATTRIBUTION = `${STADIA} ${OPENMAPTILES} ${OSM_ATTRIBUTION}`
const STAMEN_ATTRIBUTION = `${STADIA} ${STAMEN} ${OPENMAPTILES} ${OSM_ATTRIBUTION}`

/** Stadia styles that suit the paper-map look. Pick one with VITE_MAP_STYLE. */
export const MAP_STYLES = {
  // Muted, labelled; closest to the CARTO Positron look the game launched with
  alidade_smooth: { ext: "{r}.png", attribution: STADIA_ATTRIBUTION, maxZoom: 20 },
  // High-contrast black and white, labelled
  stamen_toner_lite: { ext: "{r}.png", attribution: STAMEN_ATTRIBUTION, maxZoom: 20 },
  // Painterly and unlabelled, so guessing gets harder
  stamen_watercolor: { ext: ".jpg", attribution: STAMEN_ATTRIBUTION, maxZoom: 16 },
} as const

export type MapStyle = keyof typeof MAP_STYLES

export const DEFAULT_MAP_STYLE: MapStyle = "alidade_smooth"

export function stadiaProvider(style: string | undefined, apiKey?: string): TileProvider {
  const name: MapStyle = style && style in MAP_STYLES ? (style as MapStyle) : DEFAULT_MAP_STYLE
  const { ext, attribution, maxZoom } = MAP_STYLES[name]
  const key = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ""
  return {
    url: `https://tiles.stadiamaps.com/tiles/${name}/{z}/{x}/{y}${ext}${key}`,
    attribution,
    maxZoom,
  }
}

/** Used only if the primary provider fails (e.g. domain not registered with Stadia). */
export const FALLBACK_TILES: TileProvider = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
}

export const PRIMARY_TILES: TileProvider = stadiaProvider(
  import.meta.env.VITE_MAP_STYLE,
  import.meta.env.VITE_STADIA_API_KEY
)
