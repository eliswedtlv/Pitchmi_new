"use client"

import { useEffect, useRef } from "react"

/**
 * Requests a screen wake lock when `active` is true, releases when false.
 * Re-acquires on visibility change — iOS/Android auto-release the lock when the
 * tab is hidden or the screen dims, so we re-request when it becomes visible to
 * hold the lock for the whole active window (e.g. a 1–2 min evaluate wait).
 * Silently fails if the wake lock API is unavailable.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active) {
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
      return
    }

    const wakeLockApi = typeof navigator !== "undefined" ? navigator.wakeLock : undefined
    if (!wakeLockApi) return

    let cancelled = false

    const acquire = async () => {
      if (cancelled || lockRef.current) return
      try {
        const lock = await wakeLockApi.request("screen")
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
        // When the OS auto-releases (tab hidden), drop our ref so we can re-acquire.
        lock.addEventListener("release", () => {
          if (lockRef.current === lock) lockRef.current = null
        })
      } catch {
        /* wake lock denied — best effort */
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire()
    }

    acquire()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [active])
}
