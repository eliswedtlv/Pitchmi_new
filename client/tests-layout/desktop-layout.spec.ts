import { test, expect, type Page } from "@playwright/test"

/**
 * The objective form of the two things T-10024 was asked to fix, both of which
 * had previously only ever been judged by eye:
 *
 *  1. `/` used to end just below the Record button, leaving ~40% of a phone
 *     screen as bare canvas. "The screen does not end two thirds of the way
 *     down" is measurable: the content wrapper's height against the viewport's.
 *
 *  2. `/results` at 1440×900 used to be the 512px phone column centred in the
 *     window. "A genuine two-column composition" is measurable too, and it is
 *     specifically NOT "the two things are both on screen": side-by-side means
 *     their vertical ranges OVERLAP while their horizontal ranges DO NOT.
 *     A stack passes the first half and fails the second.
 *
 * Both run in a real browser, because neither claim is expressible in jsdom —
 * it has no layout.
 */

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  return box
}

/** Do the two boxes share any vertical extent? */
function verticallyOverlap(a: Box, b: Box): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height
}

/** Do the two boxes share any horizontal extent? */
function horizontallyOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
}

test.describe("the composer fills the viewport", () => {
  for (const vp of [
    { name: "390×844 (phone)", width: 390, height: 844 },
    { name: "1440×900 (desktop)", width: 1440, height: 900 },
  ]) {
    test(`${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/")
      await expect(page.getByLabel("Your script")).toBeVisible()

      // The outermost content wrapper inside <main> — the `.shell` element that
      // holds the header, the writing surface and the Record button.
      const wrapper = await boxOf(page, "main > div")
      const fill = wrapper.height / vp.height

      expect(
        fill,
        `the composer wrapper is ${Math.round(wrapper.height)}px of a ${vp.height}px ` +
          `viewport (${Math.round(fill * 100)}%); the screen still ends early`,
      ).toBeGreaterThanOrEqual(0.8)

      // …and the writing surface remains the largest object, rather than the
      // viewport being filled with decorative whitespace. The launch redesign
      // adds a real product statement above the mobile deck, so the old >50%
      // ratio is no longer the right contract; >35% still guarantees a
      // comfortably dominant editor at the narrowest composition.
      const textarea = await boxOf(page, "textarea")
      expect(textarea.height / wrapper.height).toBeGreaterThan(0.35)
    })
  }

  // The composer is top-aligned on a phone on purpose: a vertically centred
  // composition fights the on-screen keyboard. Growing it must not have
  // recentred it.
  test("stays top-aligned on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await expect(page.getByLabel("Your script")).toBeVisible()

    const header = await boxOf(page, "main header")
    expect(header.y).toBeLessThan(120)
  })
})

test.describe("/results is a real two-column composition on a desktop", () => {
  test("1440×900: the video and the score panel sit side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/dev/ui/results")
    await expect(page.getByText("Overall score")).toBeVisible()

    const video = await boxOf(page, "video")
    const score = await boxOf(page, '[data-testid="score-panel"]')

    expect(verticallyOverlap(video, score), "they must share vertical extent").toBe(true)
    expect(horizontallyOverlap(video, score), "they must not share horizontal extent").toBe(false)
  })

  test("390×844: the same two objects are stacked, not side by side", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dev/ui/results")
    await expect(page.getByText("Overall score")).toBeVisible()

    const video = await boxOf(page, "video")
    const score = await boxOf(page, '[data-testid="score-panel"]')

    expect(verticallyOverlap(video, score), "stacked: no shared vertical extent").toBe(false)
    expect(horizontallyOverlap(video, score), "stacked: they share the column").toBe(true)
  })

  // 1024 is the `lg` breakpoint itself — the width at which a desktop layout
  // most often breaks, because the two columns appear in the same frame that
  // the container stops growing. Nothing may overflow horizontally there.
  test("1024×768: two columns, and no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto("/dev/ui/results")
    await expect(page.getByText("Overall score")).toBeVisible()

    const video = await boxOf(page, "video")
    const score = await boxOf(page, '[data-testid="score-panel"]')
    expect(horizontallyOverlap(video, score)).toBe(false)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

// The narrowest phone still in use. Every screen, both directions of text.
test.describe("360px width does not overflow horizontally", () => {
  for (const url of ["/", "/dev/ui/results", "/dev/ui/wait"]) {
    test(`${url}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 })
      await page.goto(url)
      await page.evaluate(() => document.fonts.ready)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
