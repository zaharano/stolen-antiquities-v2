import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"

// Fix Leaflet default icon issue with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" })

// Red pushpin SVG for player guess
const playerIcon = L.divIcon({
  html: `<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#E63B2E"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

// Muted green pin for correct answer
const correctIcon = L.divIcon({
  html: `<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#4A7C59"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

export interface MapViewProps {
  playerPin: [number, number] | null
  correctPin: [number, number] | null
  onPinPlace: (lat: number, lng: number) => void
  showReveal: boolean
  interactive: boolean
}

// Inner component to handle map click events
function ClickHandler({
  onPinPlace,
  interactive,
}: {
  onPinPlace: (lat: number, lng: number) => void
  interactive: boolean
}) {
  useMapEvents({
    click(e) {
      if (!interactive) return
      onPinPlace(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Inner component to fit bounds when reveal happens
function BoundsFitter({
  playerPin,
  correctPin,
  showReveal,
}: {
  playerPin: [number, number] | null
  correctPin: [number, number] | null
  showReveal: boolean
}) {
  const map = useMap()
  const prevShowReveal = useRef(false)

  useEffect(() => {
    if (showReveal && !prevShowReveal.current && playerPin && correctPin) {
      const bounds = L.latLngBounds([playerPin, correctPin])
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 8 })
    }
    prevShowReveal.current = showReveal
  }, [showReveal, playerPin, correctPin, map])

  return null
}

export function MapView({
  playerPin,
  correctPin,
  onPinPlace,
  showReveal,
  interactive,
}: MapViewProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="w-full h-full"
      style={{ cursor: interactive ? "crosshair" : "default" }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      <ClickHandler onPinPlace={onPinPlace} interactive={interactive} />

      <BoundsFitter
        playerPin={playerPin}
        correctPin={correctPin}
        showReveal={showReveal}
      />

      {/* Player's pin */}
      {playerPin && (
        <Marker position={playerPin} icon={playerIcon} />
      )}

      {/* Correct location pin — only on reveal */}
      {showReveal && correctPin && (
        <Marker position={correctPin} icon={correctIcon} />
      )}

      {/* Dashed line between guess and correct — only on reveal */}
      {showReveal && playerPin && correctPin && (
        <Polyline
          positions={[playerPin, correctPin]}
          pathOptions={{
            color: "#E63B2E",
            weight: 2,
            dashArray: "6, 8",
            opacity: 0.8,
          }}
        />
      )}
    </MapContainer>
  )
}
