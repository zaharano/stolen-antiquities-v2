import { expect, test } from "@playwright/test"
import {
  completedGame,
  expectNoHorizontalOverflow,
  expectNoOverlap,
  expectOnTop,
  hasSidePanel,
  startGame,
  stubNetwork,
  todayKey,
} from "./fixtures"

test.beforeEach(async ({ context }) => {
  await stubNetwork(context)
})

test("splash fits the screen", async ({ page }) => {
  await page.goto("/")
  await expectOnTop(page.getByRole("button", { name: "Begin" }), "Begin button")
  await expectNoHorizontalOverflow(page)
})

test("a full round: nothing important is ever covered", async ({ page }, testInfo) => {
  await startGame(page)
  const sheet = page.getByRole("region", { name: "Object details" })
  const side = await hasSidePanel(page)

  await expectNoHorizontalOverflow(page)
  await expectOnTop(page.locator('[aria-label$="seconds remaining"]'), "timer")
  await expectOnTop(page.locator(".leaflet-control-zoom-in"), "zoom in")
  await expectOnTop(page.locator(".leaflet-control-zoom-out"), "zoom out")
  if (!side) {
    // Very narrow phones may need to scroll the sheet; the hint must be reachable and uncovered
    const hint = page.getByRole("button", { name: "Medium" })
    await hint.scrollIntoViewIfNeeded()
    await expectOnTop(hint, "first hint")
    // Labels must wrap inside narrow hint buttons, not spill out of them
    for (const button of await page.getByRole("button", { name: /pts/ }).all()) {
      const spills = await button.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(spills, "hint label overflows its button").toBe(false)
    }
  }
  await testInfo.attach("playing", { body: await page.screenshot(), contentType: "image/png" })

  // Place a pin in the middle of the map
  const map = page.locator("main")
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  const confirm = page.getByRole("button", { name: "Confirm Placement" })
  await expectOnTop(confirm, "Confirm button")
  if (!side) await expectNoOverlap(confirm, sheet, "Confirm button and sheet")
  await testInfo.attach("pin placed", { body: await page.screenshot(), contentType: "image/png" })

  await confirm.click()
  const next = page.getByRole("button", { name: "Next Object →" })
  await expect(next).toBeEnabled() // enabled once it has faded in
  await expectOnTop(next, "Next button")
  if (!side) await expectNoOverlap(next, sheet, "reveal card and sheet")

  // Both pins land in the map area and clear of the reveal card
  await page.waitForTimeout(800) // fitBounds animation
  const card = next.locator("xpath=ancestor::div[contains(@class,'shadow-xl')]")
  const pins = page.locator(".leaflet-marker-icon")
  await expect(pins).toHaveCount(2)
  const mapBox = (await map.boundingBox())!
  for (const pin of await pins.all()) {
    const p = (await pin.boundingBox())!
    expect(p.y, "pin above the top of the map").toBeGreaterThanOrEqual(mapBox.y)
    expect(p.x, "pin off the left of the map").toBeGreaterThanOrEqual(mapBox.x)
    expect(p.x + p.width, "pin off the right of the map").toBeLessThanOrEqual(mapBox.x + mapBox.width)
    await expectNoOverlap(pin, card, "pin and reveal card")
  }
  await testInfo.attach("reveal", { body: await page.screenshot(), contentType: "image/png" })

  await next.click()
  await expect(page.getByText(/2\/10|Object 2 \/ 10/)).toBeVisible()
})

test("sheet opens for each object and gets out of the way of the map", async ({ page }) => {
  await startGame(page)
  test.skip(await hasSidePanel(page), "side panel layout has no sheet")

  const collapse = page.getByRole("button", { name: "Collapse object panel" })
  const expand = page.getByRole("button", { name: "Expand object panel" })
  await expect(collapse).toBeVisible()

  await collapse.click()
  await expect(expand).toBeVisible()
  await expectOnTop(expand, "collapsed sheet")
  await expand.click()
  await expect(collapse).toBeVisible()

  // Touching the map collapses the sheet
  const box = (await page.locator("main").boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 40)
  await expect(expand).toBeVisible()
})

test("full-size image covers everything and closes", async ({ page }) => {
  await startGame(page)
  const enlarge = page.getByRole("button", { name: "Enlarge image" })
  await expect(enlarge.locator("img")).toHaveCSS("opacity", "1")
  await enlarge.click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  const close = page.getByRole("button", { name: "Close image" })
  await expectOnTop(close, "close button")
  // The timer and map controls must not draw over the modal
  const topLeftIsDialog = await page.evaluate(() => {
    const hit = document.elementFromPoint(20, 20)
    return !!hit?.closest('[role="dialog"]')
  })
  expect(topLeftIsDialog).toBe(true)

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("reloading mid-round keeps the clock running", async ({ page }) => {
  await startGame(page)
  // Pretend the round started 12 seconds ago, then reload
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!)
    state.rounds[0].startedAt = Date.now() - 12_000
    localStorage.setItem(key, JSON.stringify(state))
  }, todayKey())
  await page.reload()
  await page.getByRole("button", { name: "Begin" }).click()

  const label = await page.locator('[aria-label$="seconds remaining"]').getAttribute("aria-label")
  const seconds = Number(label!.split(" ")[0])
  expect(seconds).toBeLessThanOrEqual(18)
  expect(seconds).toBeGreaterThanOrEqual(14)
})

test("a pin left on the map counts when time runs out", async ({ page }) => {
  await startGame(page)
  const box = (await page.locator("main").boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByRole("button", { name: "Confirm Placement" })).toBeVisible()

  // Run the clock out (via storage + reload, which also checks the pin persisted)
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!)
    state.rounds[0].startedAt = Date.now() - 31_000
    localStorage.setItem(key, JSON.stringify(state))
  }, todayKey())
  await page.reload()
  await page.getByRole("button", { name: "Begin" }).click()

  await expect(page.getByText("distance")).toBeVisible()
  await expect(page.getByText("Time's up")).toHaveCount(0)
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2)
})

test("results: fits the screen and the map doesn't trap scrolling", async ({ page }, testInfo) => {
  await page.addInitScript(
    ([key, state]) => localStorage.setItem(key, state),
    [todayKey(), JSON.stringify(completedGame())] as const
  )
  await page.goto("/")
  await page.getByRole("button", { name: "View Results" }).click()
  await expect(page.getByText("Map Overview")).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const gate = page.getByRole("button", { name: "Explore the map" })
  if (testInfo.project.use.hasTouch) {
    await gate.scrollIntoViewIfNeeded()
    await expectOnTop(gate, "map touch gate")
    await gate.click()
    await expect(gate).toHaveCount(0)
  } else {
    await expect(gate).toHaveCount(0)
  }
  await testInfo.attach("results", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
})

test("a failed load shows an error with a working retry", async ({ page, context }) => {
  await context.route(/seed-objects\.json/, (r) => r.fulfill({ status: 500, body: "" }))
  await page.goto("/")
  await page.getByRole("button", { name: "Begin" }).click()
  await expect(page.getByText("couldn't load today's objects")).toBeVisible()

  await context.unroute(/seed-objects\.json/)
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.locator('[aria-label$="seconds remaining"]')).toHaveCount(1)
})
