"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AdConfig } from "@/lib/api"

interface AdSlotProps {
  config: AdConfig
  onSkip?: () => void
}

/**
 * Isolated ad component — swap this for a real ad network without touching the flow.
 */
export function AdSlot({ config, onSkip }: AdSlotProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [canSkip, setCanSkip] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(config.skippable_after_s)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          setCanSkip(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [config.skippable_after_s])

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    // Restyled to the tokens (T-10022) — WHEN this appears is untouched and
    // remains T-10023's call.
    <div className="scheme-dark relative w-full rounded-panel overflow-hidden border border-line bg-media aspect-video">
      <video
        ref={videoRef}
        src={config.url}
        muted
        autoPlay
        playsInline
        loop
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 start-2">
        <Badge variant="secondary">Ad</Badge>
      </div>
      <div className="absolute bottom-2 end-2">
        {canSkip ? (
          <Button size="sm" variant="secondary" onClick={onSkip}>
            Skip Ad
          </Button>
        ) : (
          <span className="nums rounded-control bg-media/60 px-2.5 py-1 text-micro text-media-fg">
            Skip in {secondsLeft}s
          </span>
        )}
      </div>
    </div>
  )
}
