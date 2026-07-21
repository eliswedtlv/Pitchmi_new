import { test, expect, type Page } from "@playwright/test"

// The acceptance gate for the RTL rebuild (T-1163 §A): with a real browser
// laying out the real Prompter, Hebrew words must run right-to-left and the
// Latin brand token must sit in its logical position between Hebrew neighbours;
// English must run left-to-right.

interface WordBox {
  idx: number
  text: string
  cx: number // horizontal centre
  top: number
}

async function readWords(page: Page): Promise<WordBox[]> {
  await page.waitForSelector("[data-widx]")
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("[data-widx]"))
    return nodes.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        idx: Number(el.getAttribute("data-widx")),
        text: (el.textContent ?? "").trim(),
        cx: r.left + r.width / 2,
        top: Math.round(r.top),
      }
    })
  })
}

// Words sharing the top-most visual row, in logical (DOM) order.
function topRow(words: WordBox[]): WordBox[] {
  const top = Math.min(...words.map((w) => w.top))
  return words.filter((w) => Math.abs(w.top - top) <= 4).sort((a, b) => a.idx - b.idx)
}

test("Hebrew: words lay out right-to-left with the Latin token in logical position", async ({ page }) => {
  await page.goto("/dev/prompter-layout/he")
  const words = await readWords(page)
  const row = topRow(words)
  expect(row.length).toBeGreaterThanOrEqual(3)

  // (a) Strictly right-to-left: each later logical word sits further LEFT.
  for (let i = 1; i < row.length; i++) {
    expect(row[i].cx, `word[${row[i].idx}] "${row[i].text}" must be left of previous`).toBeLessThan(
      row[i - 1].cx,
    )
  }

  // (b) The Latin token sits between its Hebrew neighbours per logical order.
  const pitch = words.find((w) => w.text === "PitchMi")!
  const before = words.find((w) => w.idx === pitch.idx - 1)! // logically previous
  const after = words.find((w) => w.idx === pitch.idx + 1)! // logically next
  expect(Math.abs(before.top - pitch.top)).toBeLessThanOrEqual(4)
  expect(Math.abs(after.top - pitch.top)).toBeLessThanOrEqual(4)
  expect(pitch.cx).toBeLessThan(before.cx) // left of the earlier word
  expect(pitch.cx).toBeGreaterThan(after.cx) // right of the later word
})

test("English: words lay out left-to-right", async ({ page }) => {
  await page.goto("/dev/prompter-layout/en")
  const words = await readWords(page)
  const row = topRow(words)
  expect(row.length).toBeGreaterThanOrEqual(3)

  // (c) Strictly left-to-right: each later logical word sits further RIGHT.
  for (let i = 1; i < row.length; i++) {
    expect(row[i].cx, `word[${row[i].idx}] "${row[i].text}" must be right of previous`).toBeGreaterThan(
      row[i - 1].cx,
    )
  }
})
