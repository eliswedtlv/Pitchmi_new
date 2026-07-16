"use client"

import { useEffect, useRef } from "react"

/**
 * Requests a screen wake lock when `active` is true, releases when false.
 * Silently fails if wake lock API is unavailable.
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
    wakeLockApi
      .request("screen")
      .then((lock) => {
        if (!cancelled) lockRef.current = lock
        else lock.release().catch(() => {})
      })
      .catch(() => {})

    return () => {
      cancelled = true
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [active])
}
