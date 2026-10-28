import { useEffect, useRef } from "react"
import { AttributionControl, Circle, MapContainer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import { BaseTileLayer } from "./BaseTileLayer"
import type { ScoringZones } from "../lib/scoring"

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

// Inhabited world, roughly: fits on any screen at the start of each round
const WORLD_BOUNDS = L.latLngBounds([-50, -170], [72, 190])

// Space kept clear at the bottom of the map for the reveal card, if it can't
// be measured (see BoundsFitter)
const REVEAL_CARD_SPACE = 300

// On touch screens a double-tap would also drop a pin; pinch zoom covers it
const isCoarsePointer =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches

export interface MapViewProps {
  playerPin: [number, number] | null
  correctPin: [number, number] | null
  onPinPlace: (lat: number, lng: number) => void
  showReveal: boolean
  interactive: boolean
  roundKey: number  // changes each round — triggers view reset
  /** Called on any touch/click on the map (used to collapse the mobile sheet) */
  onUserInteract?: () => void
  /** Scoring radii drawn around the answer at the reveal */
  zones?: ScoringZones
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

// Keep Leaflet in sync with its container, which resizes as the mobile sheet
// opens and closes. pan: false keeps the top-left fixed, so whatever is under
// the player's finger doesn't move while they tap.
function SizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

function InteractionWatcher({ onUserInteract }: { onUserInteract?: () => void }) {
  const map = useMap()
  const callback = useRef(onUserInteract)
  useEffect(() => {
    callback.current = onUserInteract
  })
  useEffect(() => {
    const container = map.getContainer()
    const handler = () => callback.current?.()
    container.addEventListener("pointerdown", handler)
    return () => container.removeEventListener("pointerdown", handler)
  }, [map])
  return null
}

// Inner component to reset view to the whole world on each new round
function ViewResetter({ roundKey }: { roundKey: number }) {
  const map = useMap()
  const prevRoundKey = useRef(roundKey)

  useEffect(() => {
    if (roundKey !== prevRoundKey.current) {
      map.flyToBounds(WORLD_BOUNDS, { duration: 0.6 })
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
    if (showReveal && !prevShowReveal.current && correctPin) {
      const bounds = L.latLngBounds(playerPin ? [playerPin, correctPin] : [correctPin])
      // Keep both pins clear of the reveal card along the bottom. The card is
      // a sibling of the map (RevealOverlay, marked data-reveal-card), so
      // measure how far its top edge reaches up into the map.
      const container = map.getContainer()
      const card = container.parentElement?.querySelector("[data-reveal-card]")
      const cardSpace = card
        ? container.getBoundingClientRect().bottom - card.getBoundingClientRect().top + 16
        : REVEAL_CARD_SPACE
      const bottom = Math.min(cardSpace, map.getSize().y * 0.6)
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, bottom],
        maxZoom: 6,
      })
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
  onUserInteract,
  zones,
}: MapViewProps) {
  return (
    <MapContainer
      bounds={WORLD_BOUNDS}
      zoomSnap={0.25}
      className="w-full h-full"
      style={{ cursor: interactive ? "crosshair" : "default" }}
      zoomControl={true}
      attributionControl={false}
      doubleClickZoom={!isCoarsePointer}
    >
      {/* Bottom edge: rarely tapped (ocean, Antarctica), unlike the top of the map.
          The Confirm button and reveal card sit just above it. */}
      <AttributionControl position="bottomright" prefix={false} />
      <BaseTileLayer />

      <SizeWatcher />
      <InteractionWatcher onUserInteract={onUserInteract} />
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

      {/* Scoring zones around the answer — only on reveal. Gold disc: full
          points; dashed ring: "close" medal. */}
      {showReveal && correctPin && zones && (
        <>
          <Circle
            center={correctPin}
            radius={zones.closeKm * 1000}
            interactive={false}
            className="scoring-zone-close"
            pathOptions={{ color: "#B8A88A", weight: 1.5, dashArray: "4 4", fill: false }}
          />
          <Circle
            center={correctPin}
            radius={zones.fullPointsKm * 1000}
            interactive={false}
            className="scoring-zone-full"
            pathOptions={{ color: "#C8A951", weight: 1, fillColor: "#C8A951", fillOpacity: 0.18 }}
          />
        </>
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
