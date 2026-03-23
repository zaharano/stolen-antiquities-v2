import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"

// Fix Leaflet default icon issue with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" })

// Red pushpin SVG for player guess
const playerIcon = L.divIcon({
  html: `<div style="width:24px;height:36px"><svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#E63B2E"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg></div>`,
  className: "",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

// Muted green pin for correct answer
const correctIcon = L.divIcon({
  html: `<div style="width:24px;height:36px"><svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#4A7C59"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg></div>`,
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
  roundKey: number  // changes each round — triggers view reset
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

// Inner component to reset view to world level on each new round
function ViewResetter({ roundKey }: { roundKey: number }) {
  const map = useMap()
  const prevRoundKey = useRef(roundKey)

  useEffect(() => {
    if (roundKey !== prevRoundKey.current) {
      map.flyTo([20, 0], 2, { duration: 0.6 })
      prevRoundKey.current = roundKey
    }
  }, [roundKey, map])

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
  roundKey,
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
      <ViewResetter roundKey={roundKey} />

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

      {/* Dashed animated line between guess and correct — only on reveal */}
      {showReveal && playerPin && correctPin && (() => {
        // Adjust longitude so Leaflet draws the shorter arc across the antimeridian
        let lng2 = correctPin[1]
        const lngDiff = lng2 - playerPin[1]
        if (lngDiff > 180) lng2 -= 360
        else if (lngDiff < -180) lng2 += 360
        return (
          <Polyline
            positions={[playerPin, [correctPin[0], lng2]]}
            className="leaflet-reveal-line"
            pathOptions={{
              color: "#E63B2E",
              weight: 2,
              dashArray: "6 4",
              opacity: 0.85,
            }}
          />
        )
      })()}
    </MapContainer>
  )
}
