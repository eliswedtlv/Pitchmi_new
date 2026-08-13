import { describe, expect, it } from "vitest"
import type { User } from "@supabase/supabase-js"
import {
  accountStateFromUser,
  callbackErrorCode,
  safeOAuthDestination,
  safeNextPath,
} from "../googleAuth"

function user(overrides: Partial<User>): User {
  return {
    id: "u1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  } as User
}

describe("Google auth helpers", () => {
  it("keeps OAuth return paths on the KillerPitch origin", () => {
    expect(safeNextPath("/account?linked=1")).toBe("/account?linked=1")
    expect(safeNextPath("https://evil.example/steal")).toBe("/account")
    expect(safeNextPath("//evil.example/steal")).toBe("/account")
    expect(safeNextPath("\\\\evil.example/steal")).toBe("/account")
    expect(safeNextPath("javascript:alert(1)")).toBe("/account")
  })

  it("distinguishes temporary and permanent users without storing profile data", () => {
    expect(accountStateFromUser(null)).toEqual({ kind: "guest" })
    expect(accountStateFromUser(user({ is_anonymous: true }))).toEqual({ kind: "anonymous" })
    expect(
      accountStateFromUser(
        user({
          is_anonymous: false,
          email: "eli@example.com",
          user_metadata: { full_name: "Eli W" },
        }),
      ),
    ).toEqual({ kind: "permanent", name: "Eli W", email: "eli@example.com" })
  })

  it("allows only secure provider redirects, with an explicit localhost exception", () => {
    expect(safeOAuthDestination("https://accounts.example.test/oauth")).toBe(
      "https://accounts.example.test/oauth",
    )
    expect(safeOAuthDestination("http://127.0.0.1:54321/auth/v1/authorize")).toBe(
      "http://127.0.0.1:54321/auth/v1/authorize",
    )
    expect(safeOAuthDestination("http://accounts.example.test/oauth")).toBeNull()
    expect(safeOAuthDestination("javascript:alert(1)")).toBeNull()
    expect(safeOAuthDestination("not a URL")).toBeNull()
  })

  it("reads provider callback errors from query or hash parameters", () => {
    expect(callbackErrorCode("https://killerpitch.test/auth/complete?error_code=identity_already_exists"))
      .toBe("identity_already_exists")
    expect(callbackErrorCode("https://killerpitch.test/auth/complete#error=access_denied"))
      .toBe("access_denied")
    expect(callbackErrorCode("https://killerpitch.test/auth/complete")).toBeNull()
  })
})
