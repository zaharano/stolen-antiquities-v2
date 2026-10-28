import { useRef, useState } from "react"
import { TileLayer } from "react-leaflet"
import L from "leaflet"
import { FALLBACK_TILES, PRIMARY_TILES } from "../lib/map-tiles"

// Fix Leaflet default icon issue with Vite (all our markers use divIcons)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" })

// Switch to the fallback provider after this many tile errors with no
// successful tile load (e.g. Stadia returning 401 for an unregistered domain)
const FALLBACK_AFTER_ERRORS = 4

// Shared across maps so the results map doesn't retry a provider that already failed
let primaryFailed = false

export function BaseTileLayer() {
  const [provider, setProvider] = useState(primaryFailed ? FALLBACK_TILES : PRIMARY_TILES)
  const loaded = useRef(0)
  const errors = useRef(0)

  return (
    <TileLayer
      key={provider.url}
      url={provider.url}
      attribution={provider.attribution}
      maxZoom={provider.maxZoom}
      eventHandlers={{
        tileload: () => {
          loaded.current++
        },
        tileerror: () => {
          errors.current++
          if (
            provider === PRIMARY_TILES &&
            loaded.current === 0 &&
            errors.current >= FALLBACK_AFTER_ERRORS
          ) {
            console.warn("Primary map tiles failed to load; falling back to OpenStreetMap")
            primaryFailed = true
            setProvider(FALLBACK_TILES)
          }
        },
      }}
    />
  )
}
