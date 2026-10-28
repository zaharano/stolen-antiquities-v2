import { defineConfig } from "@playwright/test"

// End-to-end layout checks on phone, tablet and desktop sizes. External hosts
// (Met API, map tiles, fonts) are stubbed in e2e/fixtures.ts, so the suite
// runs offline. Everything runs in Chromium with device-sized viewports.
const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone-se", use: { ...phone, viewport: { width: 375, height: 667 } } },
    { name: "iphone-15", use: { ...phone, viewport: { width: 393, height: 852 } } },
    { name: "pixel-7", use: { ...phone, viewport: { width: 412, height: 915 } } },
    { name: "fold-closed", use: { ...phone, viewport: { width: 280, height: 653 } } },
    { name: "phone-landscape", use: { ...phone, viewport: { width: 844, height: 390 } } },
    { name: "ipad-mini", use: { ...phone, viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
