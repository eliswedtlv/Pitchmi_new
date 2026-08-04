import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

/**
 * Release-UI review artifact (T-10022). Eli reviews UI by looking at it, so this
 * writes full-page screenshots of every in-scope screen at both viewports in
 * BOTH colour schemes into `docs/ui/`, committed alongside the code.
 *
 * This is not a visual-regression test — nothing here fails on a pixel diff. It
 * fails only if a screen does not render, and it exists to produce the images.
 * It is also the only check that can catch a dark-mode failure at all: jsdom has
 * no colour scheme.
 *
 * /results and /wait are shot through the dev fixtures at /dev/ui/[screen],
 * which render the real screens against seeded state (see that route). /karaoke
 * needs a camera and is excluded — check it by hand.
 */

const OUT = path.resolve(__dirname, "../../docs/ui")

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 }, // iPhone 12 portrait
  // T-10024: 1024 is the `lg` breakpoint itself — the width where a desktop
  // layout most often breaks, because the second column appears in the same
  // frame that the container stops growing.
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const

const SCREENS = [
  { name: "home", url: "/", ready: "text=Say it like" },
  { name: "results", url: "/dev/ui/results", ready: "text=Overall score" },
  { name: "wait", url: "/dev/ui/wait", ready: "text=Analyzing your take" },
  { name: "wait-error", url: "/dev/ui/wait-error", ready: "text=took too long" },
  // Restyled in T-10024 (shared shell width + a two-up grid at `lg`), so it is
  // shot too. It has no fixture: /videos reads Supabase directly, and with no
  // client configured it renders its error line above the empty state — which
  // is still the real shell, the real card and the real primary button.
  { name: "videos", url: "/videos", ready: "text=My Videos" },
] as const

const SCHEMES = ["light", "dark"] as const

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
})

for (const viewport of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    test.describe(`${viewport.name} · ${scheme}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
      })

      for (const screen of SCREENS) {
        test(`${screen.name}`, async ({ page }) => {
          await page.goto(screen.url)
          // The shots come off the dev server (see playwright.config.ts), which
          // paints its own build-status badge over the corner. It is not part of
          // the product.
          await page.addStyleTag({ content: "nextjs-portal { display: none !important }" })
          await expect(page.locator(screen.ready).first()).toBeVisible()
          // Let the self-hosted fonts settle so the shots are not a mix of
          // fallback and final metrics.
          await page.evaluate(() => document.fonts.ready)

          await page.screenshot({
            path: path.join(OUT, `${screen.name}-${viewport.name}-${scheme}.png`),
            fullPage: true,
            animations: "disabled",
          })
        })
      }
    })
  }
}
