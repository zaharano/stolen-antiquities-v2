import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { GameRound } from "../types"
import { HINT_PENALTY } from "../lib/scoring"

interface ObjectPanelProps {
  round: GameRound
  roundNumber: number
  totalRounds: number
  onHintReveal: (index: number) => void
  /**
   * "side": the desktop / landscape side panel (round header, large image).
   * "sheet": inside the mobile bottom sheet (no header, the HUD shows the
   * round; compact image and side-by-side hints so it fits about half a phone
   * screen).
   */
  variant: "side" | "sheet"
}

interface HintDefinition {
  index: number
  label: string
  content: string
}

function getHints(round: GameRound): HintDefinition[] {
  const hints: HintDefinition[] = []
  if (round.metData) {
    if (round.metData.medium) {
      hints.push({ index: hints.length, label: "Medium", content: round.metData.medium })
    }
    const dept = [round.metData.department, round.metData.creditLine]
      .filter(Boolean)
      .join(" — ")
    if (dept) {
      hints.push({ index: hints.length, label: "Department", content: dept })
    }
  }
  return hints
}

function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Portal to <body> so the modal sits above the map, HUD and sheet
  // regardless of which stacking context the panel is rendered in
  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/85 p-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute right-3 w-11 h-11 bg-ink text-cream rounded-full text-base flex items-center justify-center hover:bg-ink-light"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label="Close image"
      >
        ✕
      </button>
    </div>,
    document.body
  )
}

export function ObjectPanel({
  round,
  roundNumber,
  totalRounds,
  onHintReveal,
  variant,
}: ObjectPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)
  // The parent keys this component by objectID, so these reset each round
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const isSheet = variant === "sheet"
  const hints = getHints(round)
  const imageSrc = round.metData?.primaryImageSmall || round.metData?.primaryImage

  const handleHintClick = (index: number) => {
    if (index < round.hintsUsed) return // already revealed
    onHintReveal(index)
  }

  return (
    <>
      {/* Full-res modal */}
      {modalOpen && round.metData?.primaryImage && (
        <ImageModal
          src={round.metData.primaryImage}
          alt={round.metData?.title ?? "Object image"}
          onClose={() => setModalOpen(false)}
        />
      )}

      <div
        className="bg-parchment flex flex-col"
        style={{ fontFamily: "'Source Serif 4', serif" }}
      >
        {/* Round indicator (the mobile HUD shows it instead) */}
        {!isSheet && (
          <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-sepia">
            <span
              className="text-ink-light text-xs uppercase tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Object {roundNumber} / {totalRounds}
            </span>
          </div>
        )}

        {round.metData === null ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-ink-light text-sm">Unable to load this object.</p>
            <p className="text-sepia-dark text-xs mt-2">
              The Metropolitan Museum API may be unavailable. You can still place a guess.
            </p>
          </div>
        ) : (
          <>
            {/* Object image — contained, so nothing that might be a clue is cropped */}
            <div
              className={`relative overflow-hidden bg-cream-dark shrink-0 ${
                isSheet ? "h-[clamp(140px,26dvh,260px)]" : "aspect-[4/3] max-h-[45dvh]"
              }`}
            >
              {/* Shimmer placeholder — shown while image is loading */}
              {imageSrc && !imgLoaded && !imgFailed && (
                <div className="absolute inset-0 shimmer-placeholder" />
              )}
              {imageSrc && !imgFailed ? (
                <button
                  type="button"
                  className="block w-full h-full cursor-zoom-in"
                  onClick={() => setModalOpen(true)}
                  aria-label="Enlarge image"
                  disabled={!round.metData.primaryImage}
                >
                  <img
                    src={imageSrc}
                    alt={round.metData.title}
                    className="w-full h-full object-contain"
                    style={{
                      opacity: imgLoaded ? 1 : 0,
                      transition: "opacity 300ms ease-out",
                    }}
                    decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgFailed(true)}
                  />
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-sepia-dark text-sm">Image unavailable</span>
                </div>
              )}
              {/* "Tap to enlarge" — only visible on touch devices via CSS */}
              {round.metData.primaryImage && imgLoaded && (
                <div className="tap-to-enlarge absolute bottom-2 right-2 bg-ink/60 text-cream text-xs px-2 py-0.5 rounded pointer-events-none">
                  Tap to enlarge
                </div>
              )}
            </div>

            {/* Title and date */}
            <div className={`px-4 border-b border-sepia ${isSheet ? "py-3" : "py-4"}`}>
              <h2
                className={`text-ink leading-snug ${isSheet ? "text-lg" : "text-xl"}`}
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {round.metData.title}
              </h2>
              {round.metData.objectDate && (
                <p className="text-ink-light text-sm mt-1">{round.metData.objectDate}</p>
              )}
            </div>

            {/* Hints */}
            {hints.length > 0 && (
              <div className={`px-4 ${isSheet ? "py-3" : "py-4"}`}>
                {!isSheet && (
                  <p className="text-ink-light text-xs uppercase tracking-widest mb-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Hints
                  </p>
                )}
                <div className={isSheet ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
                  {hints.map((hint) => {
                    const isRevealed = hint.index < round.hintsUsed
                    const isNext = hint.index === round.hintsUsed

                    return isRevealed ? (
                      <div
                        key={hint.index}
                        className="rounded border border-sepia bg-cream px-3 py-2 text-sm animate-[fadeSlideIn_150ms_ease-out] min-w-0"
                      >
                        <span className="text-ink-light text-xs uppercase tracking-wider block mb-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {hint.label}
                        </span>
                        <span className="text-ink break-words">{hint.content}</span>
                      </div>
                    ) : (
                      <button
                        key={hint.index}
                        onClick={() => handleHintClick(hint.index)}
                        disabled={!isNext}
                        className={`w-full min-h-11 text-left rounded border px-3 py-2 text-sm transition-colors
                          ${isNext
                            ? "border-sepia bg-cream-dark text-ink hover:bg-sepia/30 cursor-pointer"
                            : "border-sepia/40 bg-cream/50 text-ink-light/50 cursor-not-allowed"
                          }`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-x-2">
                          <span>{isSheet ? hint.label : `Hint ${hint.index + 1} — ${hint.label}`}</span>
                          <span
                            className="text-xs text-ink-light shrink-0"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            −{HINT_PENALTY} pts
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/** One-line summary shown in the collapsed mobile sheet. */
export function ObjectPeek({ round }: { round: GameRound }) {
  const thumb = round.metData?.primaryImageSmall
  return (
    <div className="flex items-center gap-3 px-4 pb-2 min-w-0">
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="w-11 h-11 object-cover rounded border border-sepia shrink-0"
        />
      )}
      <p
        className="flex-1 min-w-0 text-ink text-base truncate"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        {round.metData?.title ?? "Object details"}
      </p>
      <span className="text-ink-light text-xs shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        Details ↑
      </span>
    </div>
  )
}
