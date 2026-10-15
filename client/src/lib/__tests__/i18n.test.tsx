import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DICTIONARIES, errorText, strings, type UiStrings } from "../i18n"
import { LangToggle } from "@/components/LangToggle"
import { resetUiLangForTests, UI_LANG_KEY, useUiLang } from "@/hooks/useUiLang"

// KP-D: one UI dictionary, Hebrew typed against English, a header toggle that
// sets <html lang dir> and persists, and a navigator.language default.

// Compile-time guard: `tsc` / `next build` fail if the Hebrew table misses a key.
// @ts-expect-error — a table missing keys is not a UiStrings.
const incomplete: UiStrings = { home: "בית" }
void incomplete

function Probe() {
  const { t } = useUiLang()
  return (
    <>
      <LangToggle />
      <p data-testid="probe">{t.recordIt}</p>
    </>
  )
}

const originalLanguage = Object.getOwnPropertyDescriptor(window.navigator, "language")

function setNavigatorLanguage(value: string) {
  Object.defineProperty(window.navigator, "language", { value, configurable: true })
}

beforeEach(() => {
  window.localStorage.clear()
  resetUiLangForTests()
  document.documentElement.lang = "en"
  document.documentElement.dir = "ltr"
})

afterEach(() => {
  cleanup()
  if (originalLanguage) Object.defineProperty(window.navigator, "language", originalLanguage)
  else delete (window.navigator as { language?: string }).language
  window.localStorage.clear()
  act(() => resetUiLangForTests())
})

describe("UI dictionary", () => {
  it("has the same keys in Hebrew as in English, all non-empty", () => {
    expect(Object.keys(DICTIONARIES.he).sort()).toEqual(Object.keys(DICTIONARIES.en).sort())
    for (const [key, value] of Object.entries(DICTIONARIES.he)) {
      if (typeof value === "string") expect(value.trim(), key).not.toBe("")
    }
    expect(DICTIONARIES.he.privacyProcess).toHaveLength(DICTIONARIES.en.privacyProcess.length)
  })

  it("keeps the product name in Latin letters", () => {
    expect(strings("he").continueToApp).toContain("KillerPitch")
  })

  it("translates known errors and prefers the server's localized message", () => {
    expect(errorText(new Error("Network error"), "he")).toBe(strings("he").errNetwork)
    const server = Object.assign(new Error("Too long"), { body: { message: { en: "Too long", he: "ארוך מדי" } } })
    expect(errorText(server, "he")).toBe("ארוך מדי")
    expect(errorText(new Error("Some server text"), "en")).toBe("Some server text")
    expect(errorText(new Error("Some server text"), "he")).toBe(strings("he").errGeneric)
  })
})

describe("UI language", () => {
  it("defaults to Hebrew when navigator.language is he-IL", () => {
    setNavigatorLanguage("he-IL")
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe(strings("he").recordIt)
    expect(document.documentElement.lang).toBe("he")
    expect(document.documentElement.dir).toBe("rtl")
  })

  it("defaults to English for any other browser language", () => {
    setNavigatorLanguage("fr-FR")
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe("Record it")
    expect(document.documentElement.dir).toBe("ltr")
  })

  it("the toggle switches lang/dir and persists the choice", () => {
    setNavigatorLanguage("en-US")
    render(<Probe />)
    fireEvent.click(screen.getByRole("button", { name: "עברית" }))
    expect(screen.getByTestId("probe").textContent).toBe(strings("he").recordIt)
    expect(document.documentElement.lang).toBe("he")
    expect(document.documentElement.dir).toBe("rtl")
    expect(window.localStorage.getItem(UI_LANG_KEY)).toBe("he")

    // A fresh load reads the stored choice over navigator.language.
    cleanup()
    act(() => resetUiLangForTests())
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe(strings("he").recordIt)

    fireEvent.click(screen.getByRole("button", { name: "English" }))
    expect(document.documentElement.lang).toBe("en")
    expect(document.documentElement.dir).toBe("ltr")
    expect(window.localStorage.getItem(UI_LANG_KEY)).toBe("en")
  })

  it("survives a localStorage that throws", () => {
    setNavigatorLanguage("he")
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe(strings("he").recordIt)
    spy.mockRestore()
  })
})
