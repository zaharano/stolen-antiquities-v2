import { readFileSync } from "node:fs"
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test"
import type { GameRound, GameState, SeedObject } from "../src/types"

// 1×1 PNG, served for every map tile and object image
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

/** Stub every external host the game talks to, so tests run offline. */
export async function stubNetwork(context: BrowserContext, opts: { seedStatus?: number } = {}) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  await context.route(/tiles\.stadiamaps\.com|tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: PNG })
  )
  await context.route(/images\.example/, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: PNG })
  )
  await context.route(/collectionapi\.metmuseum\.org/, (r) => {
    const id = Number(r.request().url().split("/").pop())
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        objectID: id,
        // Long title on purpose: it must wrap or truncate, never overflow
        title: `Ceremonial vessel with handles in the form of animals, object ${id}`,
        primaryImage: `https://images.example/${id}.png`,
        primaryImageSmall: `https://images.example/${id}-small.png`,
        objectDate: "ca. 1500–1450 B.C.",
        medium: "Bronze, gold leaf, inlaid glass and semi-precious stones",
        department: "Test Department",
        creditLine: "Gift of a Test Donor, 1926",
      }),
    })
  })
  if (opts.seedStatus) {
    await context.route(/seed-objects\.json/, (r) => r.fulfill({ status: opts.seedStatus, body: "" }))
  }
}

export async function startGame(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Begin" }).click()
  await expect(page.locator('[aria-label$="seconds remaining"]')).toHaveCount(1)
}

/** True when the game uses the side panel (desktop, phone landscape). */
export async function hasSidePanel(page: Page) {
  return (await page.locator("aside").count()) > 0
}

export function todayKey() {
  return `stolen-antiquities-${new Date().toISOString().split("T")[0]}`
}

/** Fail if anything makes the page scroll sideways. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth, "page scrolls horizontally").toBeLessThanOrEqual(innerWidth)
}

/** Fail unless the element's centre is visible on screen and not covered by anything else. */
export async function expectOnTop(locator: Locator, name: string) {
  await expect(locator, `${name} is visible`).toBeVisible()
  const onTop = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
    const hit = document.elementFromPoint(x, y)
    return !!hit && (el === hit || el.contains(hit))
  })
  expect(onTop, `${name} is covered or off screen`).toBe(true)
}

export async function expectNoOverlap(a: Locator, b: Locator, what: string) {
  const [ra, rb] = [await a.boundingBox(), await b.boundingBox()]
  if (!ra || !rb) return
  const overlaps =
    ra.x < rb.x + rb.width && rb.x < ra.x + ra.width && ra.y < rb.y + rb.height && rb.y < ra.y + ra.height
  expect(overlaps, `${what} overlap`).toBe(false)
}

/** A finished daily game built from the real seed list, for results-screen tests. */
export function completedGame(): GameState {
  const seeds = JSON.parse(readFileSync("public/data/seed-objects.json", "utf-8")) as SeedObject[]
  const rounds: GameRound[] = seeds.slice(0, 10).map((seed, i) => ({
    seed,
    metData: {
      objectID: seed.objectID,
      title: `Ceremonial vessel with handles in the form of animals, object ${seed.objectID}`,
      primaryImage: `https://images.example/${seed.objectID}.png`,
      primaryImageSmall: `https://images.example/${seed.objectID}-small.png`,
      objectDate: "ca. 1500",
      culture: "",
      medium: "Bronze",
      department: "Test Department",
      creditLine: "",
      accessionYear: "",
      country: "",
      region: "",
      city: "",
    },
    playerGuess: i === 3 ? null : [seed.lat + 3, seed.lng + 3],
    distanceKm: i === 3 ? null : 420,
    score: i === 3 ? 0 : 940,
    medal: i === 3 ? "lost" : "close",
    hintsUsed: i % 3,
    timedOut: i === 3,
  }))
  return {
    date: new Date().toISOString().split("T")[0],
    rounds,
    currentRound: 9,
    phase: "results",
    completed: true,
  }
}
