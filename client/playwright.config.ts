import { defineConfig, devices } from "@playwright/test"

// Real-layout proof for the RTL prompter (T-1163 §A). Runs the actual Next app
// in a headless Chromium and measures word geometry — NOT jsdom.
const PORT = 3123
const BASE = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests-layout",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 900 },
  },
  projects: [{ name: "chromium" }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${BASE}/dev/prompter-layout/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
