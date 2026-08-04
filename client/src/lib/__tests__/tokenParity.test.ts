import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * The permanent fix for the bug T-10022 found by accident (T-10024).
 *
 * `cn()` builds tailwind-merge with `extendTailwindMerge`, because tailwind-merge
 * only knows Tailwind's OWN scale names: an unrecognised `text-*` value is
 * *guessed to be a font size*, so `text-primary-fg` and `text-body` landed in the
 * same conflict group and the colour was silently dropped — a black label on a
 * black button, with nothing failing anywhere.
 *
 * That fix is only as good as the list in `lib/utils.ts` staying in step with
 * `globals.css`. This test is the thing that makes them stay in step: it parses
 * the `@theme` block, extracts every token declared there, and asserts each one
 * is registered. Add a token and forget the merge list and this goes red.
 */

const ROOT = path.resolve(__dirname, "../..")
const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8")
const utils = fs.readFileSync(path.join(ROOT, "lib/utils.ts"), "utf8")

/** The body of the single `@theme { ... }` block. */
function themeBlock(source: string): string {
  const start = source.indexOf("@theme {")
  if (start === -1) throw new Error("no @theme block in globals.css")
  let depth = 0
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}") {
      depth--
      if (depth === 0) return source.slice(source.indexOf("{", start) + 1, i)
    }
  }
  throw new Error("unterminated @theme block")
}

const theme = themeBlock(css)

/** Declared custom-property names in the theme, minus the `--<prefix>-` head. */
function declared(prefix: string): string[] {
  const names = new Set<string>()
  for (const [, name] of theme.matchAll(new RegExp(`^\\s*--${prefix}-([a-z0-9-]+)\\s*:`, "gm"))) {
    names.add(name)
  }
  return [...names].sort()
}

/** The string contents of a named array literal in `utils.ts`. */
function registered(key: string): string[] {
  const at = utils.indexOf(`${key}:`)
  if (at === -1) throw new Error(`no \`${key}\` entry in lib/utils.ts`)
  const open = utils.indexOf("[", at)
  const close = utils.indexOf("]", open)
  return [...utils.slice(open, close).matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]).sort()
}

describe("globals.css ↔ lib/utils.ts token parity", () => {
  it("every --color-* token in @theme is registered with tailwind-merge", () => {
    const colors = declared("color")
    // Guard the parser itself: if the regex silently stops matching, an empty
    // list would pass every assertion below and the test would be worthless.
    expect(colors.length).toBeGreaterThan(20)
    expect(colors).toContain("accent")

    const missing = colors.filter((c) => !registered("colors").includes(c))
    expect(
      missing,
      `add these to extend.theme.colors in lib/utils.ts, or an undeclared ` +
        `text-* utility will be guessed as a font size and render invisibly`,
    ).toEqual([])
  })

  it("every --radius-* token in @theme is registered", () => {
    const radii = declared("radius")
    expect(radii.length).toBeGreaterThan(0)
    expect(radii.filter((r) => !registered("borderRadius").includes(r))).toEqual([])
  })

  it("every --text-* type step in @theme is registered as a font-size", () => {
    // `--text-title--line-height` and friends are modifiers on a step, not steps.
    const steps = declared("text").filter((t) => !t.includes("--"))
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.filter((t) => !registered("text").includes(t))).toEqual([])
  })

  it("fails when a token is added to globals.css without updating utils.ts", () => {
    // The test above can only prove today's state. This proves the mechanism:
    // an invented token is reported as missing rather than quietly passing.
    const invented = [...declared("color"), "not-a-real-token"]
    expect(invented.filter((c) => !registered("colors").includes(c))).toEqual(["not-a-real-token"])
  })
})
