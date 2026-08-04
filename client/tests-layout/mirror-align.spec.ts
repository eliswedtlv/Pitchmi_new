import { test, expect, type Page } from "@playwright/test"

/**
 * The named fragility of the home screen, made runnable (T-10024).
 *
 * The over-length amber tint is a mirror `<div>` positioned absolutely behind
 * the `<textarea>`; both layers share the `TEXT_BOX` constant. Any divergence in
 * font, size, line-height, padding, letter-spacing or width between the two
 * makes the tint drift off the words it marks — **with no failing test and no
 * error**, just a highlight sitting over the wrong text. T-10024 grew the
 * composer to fill the viewport, which changes the box the two layers share, so
 * the alignment has to be re-proved rather than assumed.
 *
 * T-10022 proved it by hand: paint the real textarea text red on top of the tint
 * and look. This is that proof, automated. A textarea's value is not in the DOM
 * as text nodes, so it cannot be measured directly — instead the test builds a
 * PROBE layer in the same containing block, copies the **textarea's own computed
 * typography and box metrics** onto it, fills it with the same head/tail split,
 * and measures where the tail actually lands. If the probe's tail box and the
 * mirror's tail box agree, the tint is over the right words; if they do not, the
 * assertion names the pixels by which it drifted.
 *
 * Run in English and Hebrew, at both narrow viewports, over a script that wraps
 * well past eight lines.
 */

// The 30s cap is 75 words at the screen's 150 wpm estimate, so both of these run
// far past it: the tail alone is ~85 words of English and ~70 of Hebrew, which
// wraps over well more than the eight lines the tests demand below.
const EN = Array.from({ length: 160 }, (_, i) => `word${i}`).join(" ")
const HE = "שלום קוראים לי אלי ואני בונה מוצר שעוזר לספר סיפור בתוך שלושים שניות בלבד "
  .repeat(12)
  .trim()

interface Probe {
  mirror: { x: number; y: number; width: number; height: number }
  probe: { x: number; y: number; width: number; height: number }
  mismatched: string[]
  lines: number
  dir: string
}

/**
 * Every computed property that can move a glyph. If the textarea and the mirror
 * agree on all of these AND on their content box, they wrap identically.
 */
const GLYPH_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "fontVariantNumeric",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textIndent",
  "textTransform",
  "textAlign",
  "direction",
  "whiteSpace",
  "overflowWrap",
  "wordBreak",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
]

async function measure(page: Page, script: string): Promise<Probe> {
  await page.getByLabel("Your script").fill(script)
  await expect(page.getByTestId("over-length-tail")).toBeVisible()

  return page.evaluate((props) => {
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    const tail = document.querySelector('[data-testid="over-length-tail"]') as HTMLElement
    const mirror = tail.parentElement as HTMLElement
    const container = mirror.parentElement as HTMLElement
    const head = mirror.firstElementChild as HTMLElement

    const ta = getComputedStyle(textarea)

    // (a) Do the two REAL layers agree on everything that can move a glyph?
    const mirrorStyle = getComputedStyle(mirror)
    const mismatched = props.filter(
      (p) =>
        ta[p as keyof CSSStyleDeclaration] !== mirrorStyle[p as keyof CSSStyleDeclaration],
    )

    // (b) Build the probe: the textarea's own metrics, the same text, the same
    //     containing block, laid over the mirror exactly as the mirror is laid
    //     over the textarea.
    const probe = document.createElement("div")
    for (const p of props) {
      // @ts-expect-error indexed style write
      probe.style[p] = ta[p as keyof CSSStyleDeclaration]
    }
    probe.style.position = "absolute"
    probe.style.inset = "0"
    probe.style.overflow = "hidden"
    probe.style.borderStyle = "solid"
    probe.style.borderColor = "transparent"
    probe.style.visibility = "hidden"
    probe.dir = textarea.getAttribute("dir") ?? "ltr"

    const probeHead = document.createElement("span")
    probeHead.textContent = head.textContent
    const probeTail = document.createElement("span")
    probeTail.textContent = tail.textContent
    probe.append(probeHead, probeTail)
    container.appendChild(probe)
    // The mirror follows the textarea's scroll (`onScroll` on the textarea
    // writes `mirror.scrollTop`), so a probe left at the top would be compared
    // against a scrolled layer and report the scroll offset as drift.
    probe.scrollTop = mirror.scrollTop

    const t = tail.getBoundingClientRect()
    const p = probeTail.getBoundingClientRect()
    // Distinct line boxes the tail occupies — the proof that this is a
    // genuinely wrapped, multi-line tail and not a single-line trivial case.
    const lines = new Set(
      [...probeTail.getClientRects()].map((r) => Math.round(r.top)),
    ).size

    container.removeChild(probe)

    return {
      mirror: { x: t.x, y: t.y, width: t.width, height: t.height },
      probe: { x: p.x, y: p.y, width: p.width, height: p.height },
      mismatched,
      lines,
      dir: textarea.getAttribute("dir") ?? "ltr",
    }
  }, GLYPH_PROPS)
}

for (const vp of [
  { name: "360×640", width: 360, height: 640 },
  { name: "390×844", width: 390, height: 844 },
]) {
  for (const script of [
    { lang: "English", dir: "ltr", text: EN },
    { lang: "Hebrew", dir: "rtl", text: HE },
  ]) {
    test(`${vp.name} · ${script.lang}: the tint sits exactly under the tail`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/")
      await page.evaluate(() => document.fonts.ready)

      const m = await measure(page, script.text)

      // The direction flips with the content (T-1164), and the tint must hold
      // in both — the tail is at the LEFT end of an RTL line.
      expect(m.dir).toBe(script.dir)
      expect(m.lines, "the tail must wrap over several lines for this to prove anything")
        .toBeGreaterThanOrEqual(8)

      expect(
        m.mismatched,
        "the textarea and the mirror disagree on a property that moves glyphs — " +
          "the tint WILL drift, silently. Both layers must take it from TEXT_BOX.",
      ).toEqual([])

      // Sub-pixel rounding is real; anything beyond a pixel is drift.
      expect(Math.abs(m.probe.x - m.mirror.x), "horizontal drift").toBeLessThanOrEqual(1)
      expect(Math.abs(m.probe.y - m.mirror.y), "vertical drift").toBeLessThanOrEqual(1)
      expect(Math.abs(m.probe.width - m.mirror.width), "width drift").toBeLessThanOrEqual(1)
      expect(Math.abs(m.probe.height - m.mirror.height), "height drift").toBeLessThanOrEqual(1)
    })
  }
}
