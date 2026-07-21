import { describe, it, expect } from "vitest"
import { dirForLang, dirForText, resolveDir } from "@/lib/textDir"

describe("dirForLang", () => {
  it("maps RTL language codes to rtl", () => {
    for (const l of ["he", "ar", "fa", "ur"]) expect(dirForLang(l)).toBe("rtl")
  })
  it("maps other languages to ltr", () => {
    for (const l of ["en", "es", "fr", "de"]) expect(dirForLang(l)).toBe("ltr")
  })
  it("returns null when the language is missing", () => {
    expect(dirForLang(null)).toBeNull()
    expect(dirForLang(undefined)).toBeNull()
    expect(dirForLang("")).toBeNull()
  })
})

describe("dirForText — content sniffing", () => {
  it("detects Hebrew as rtl", () => {
    expect(dirForText("היי אני רוצה להציג")).toBe("rtl")
  })
  it("detects Arabic as rtl", () => {
    expect(dirForText("مرحبا بالعالم")).toBe("rtl")
  })
  it("treats English/Latin as ltr", () => {
    expect(dirForText("hi I want to present PitchMi")).toBe("ltr")
  })
  it("mixed text with any strong RTL char reads rtl", () => {
    expect(dirForText("Hello עולם")).toBe("rtl")
  })
  it("digits/punctuation only are ltr", () => {
    expect(dirForText("2026 — 12:30")).toBe("ltr")
  })
  it("empty/nullish text is ltr", () => {
    expect(dirForText("")).toBe("ltr")
    expect(dirForText(null)).toBe("ltr")
    expect(dirForText(undefined)).toBe("ltr")
  })
})

describe("resolveDir — language wins, text is the fallback", () => {
  it("uses the language when present (even if text disagrees)", () => {
    // Known LTR language is trusted over a stray RTL char.
    expect(resolveDir("en", "Hello עולם")).toBe("ltr")
    expect(resolveDir("he", "Latin only here")).toBe("rtl")
  })
  it("falls back to the text when the language is missing", () => {
    expect(resolveDir(null, "היי שלום")).toBe("rtl")
    expect(resolveDir(undefined, "hello world")).toBe("ltr")
  })
})
