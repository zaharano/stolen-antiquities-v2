import { useState, useEffect } from "react"
import type { GameRound } from "../types"

interface ObjectPanelProps {
  round: GameRound
  roundNumber: number
  onHintReveal: (index: number) => void
  /** Mobile only: whether the panel is expanded */
  expanded?: boolean
  onToggleExpand?: () => void
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90dvh] object-contain rounded shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 bg-ink text-cream rounded-full text-sm flex items-center justify-center hover:bg-ink-light"
          aria-label="Close image"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function ObjectPanel({
  round,
  roundNumber,
  onHintReveal,
  expanded = true,
  onToggleExpand,
}: ObjectPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Reset image loaded state when the round (and thus the image URL) changes
  useEffect(() => {
    setImgLoaded(false)
  }, [round.seed.objectID])

  const hints = getHints(round)
  const totalRounds = 10

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
        className="bg-parchment flex flex-col h-full"
        style={{ fontFamily: "'Source Serif 4', serif" }}
      >

        <div className={`flex flex-col flex-1 overflow-y-auto ${!expanded ? "hidden" : ""} lg:flex`}>
          {/* Round indicator */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-sepia">
            <span
              className="text-ink-light text-xs uppercase tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Object {roundNumber} / {totalRounds}
            </span>
          </div>

          {round.metData === null ? (
            /* Error state */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-ink-light text-sm">Unable to load this object.</p>
              <p className="text-sepia-dark text-xs mt-2">
                The Metropolitan Museum API may be unavailable. You can still place a guess.
              </p>
            </div>
          ) : (
            <>
              {/* Object image */}
              <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                {/* Shimmer placeholder — shown while image is loading */}
                {!imgLoaded && round.metData.primaryImageSmall && (
                  <div className="absolute inset-0 shimmer-placeholder" />
                )}
                {round.metData.primaryImageSmall ? (
                  <img
                    src={round.metData.primaryImageSmall}
                    alt={round.metData.title}
                    className="w-full h-full object-cover cursor-pointer"
                    style={{
                      opacity: imgLoaded ? 1 : 0,
                      transition: "opacity 300ms ease-out",
                    }}
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    onClick={() => setModalOpen(true)}
                    title="Click to view full resolution"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-cream-dark">
                    <span className="text-sepia-dark text-sm">Image unavailable</span>
                  </div>
                )}
                {/* "Tap to enlarge" — only visible on touch devices via CSS */}
                {round.metData.primaryImage && (
                  <div className="tap-to-enlarge absolute bottom-2 right-2 bg-ink/60 text-cream text-xs px-2 py-0.5 rounded pointer-events-none">
                    Tap to enlarge
                  </div>
                )}
              </div>

              {/* Title and date */}
              <div className="px-4 py-4 border-b border-sepia">
                <h2
                  className="text-ink text-xl leading-snug"
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
                <div className="px-4 py-4 flex flex-col gap-2">
                  <p className="text-ink-light text-xs uppercase tracking-widest mb-1"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Hints
                  </p>
                  {hints.map((hint) => {
                    const isRevealed = hint.index < round.hintsUsed
                    const cost = (hint.index + 1) * 150

                    return (
                      <div key={hint.index}>
                        {isRevealed ? (
                          <div className="rounded border border-sepia bg-cream px-3 py-2 text-sm animate-[fadeSlideIn_150ms_ease-out]">
                            <span className="text-ink-light text-xs uppercase tracking-wider block mb-0.5"
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              {hint.label}
                            </span>
                            <span className="text-ink">{hint.content}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleHintClick(hint.index)}
                            disabled={hint.index > round.hintsUsed}
                            className={`w-full text-left rounded border px-3 py-2 text-sm transition-colors
                              ${hint.index === round.hintsUsed
                                ? "border-sepia bg-cream-dark text-ink hover:bg-sepia/30 cursor-pointer"
                                : "border-sepia/40 bg-cream/50 text-ink-light/50 cursor-not-allowed"
                              }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>Hint {hint.index + 1} — {hint.label}</span>
                              <span
                                className="text-xs text-ink-light"
                                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              >
                                −{cost} pts
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Collapsed mobile summary (shown when not expanded) */}
        {onToggleExpand && !expanded && (
          <button
            className="flex items-center gap-3 px-4 py-3 w-full text-left"
            onClick={onToggleExpand}
          >
            {round.metData?.primaryImageSmall && (
              <img
                src={round.metData.primaryImageSmall}
                alt={round.metData?.title ?? ""}
                className="w-12 h-12 object-cover rounded border border-sepia shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p
                className="text-ink text-sm font-medium truncate"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {round.metData?.title ?? "Loading…"}
              </p>
              <p
                className="text-ink-light text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Object {roundNumber} / {totalRounds}
              </p>
            </div>
            <span className="text-ink-light text-lg">↑</span>
          </button>
        )}
      </div>
    </>
  )
}
