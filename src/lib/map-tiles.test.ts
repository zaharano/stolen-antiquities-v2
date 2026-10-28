import { describe, expect, it } from "vitest"
import { DEFAULT_MAP_STYLE, MAP_STYLES, stadiaProvider } from "./map-tiles"

describe("stadiaProvider", () => {
  it("defaults to Alidade Smooth with retina placeholder", () => {
    expect(stadiaProvider(undefined).url).toBe(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
    )
    expect(DEFAULT_MAP_STYLE).toBe("alidade_smooth")
  })

  it("falls back to the default for unknown styles", () => {
    expect(stadiaProvider("not_a_style").url).toContain("/alidade_smooth/")
  })

  it("uses the right extension and zoom for watercolor", () => {
    const p = stadiaProvider("stamen_watercolor")
    expect(p.url).toBe("https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg")
    expect(p.maxZoom).toBe(MAP_STYLES.stamen_watercolor.maxZoom)
  })

  it("appends an encoded api_key only when given", () => {
    expect(stadiaProvider("stamen_toner_lite", "a b").url).toMatch(/\{r\}\.png\?api_key=a%20b$/)
    expect(stadiaProvider("stamen_toner_lite", "").url).not.toContain("api_key")
  })

  it("credits Stadia and OpenStreetMap in every style", () => {
    for (const style of Object.keys(MAP_STYLES)) {
      const { attribution } = stadiaProvider(style)
      expect(attribution).toContain("Stadia Maps")
      expect(attribution).toContain("OpenStreetMap")
    }
  })
})
