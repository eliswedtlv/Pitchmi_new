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
    <div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video">
      <video
        ref={videoRef}
        src={config.url}
        muted
        autoPlay
        playsInline
        loop
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2">
        <Badge variant="secondary" className="text-xs">Ad</Badge>
      </div>
      <div className="absolute bottom-2 right-2">
        {canSkip ? (
          <Button size="sm" variant="secondary" onClick={onSkip}>
            Skip Ad
          </Button>
        ) : (
          <span className="text-white text-sm bg-black/60 px-2 py-1 rounded">
            Skip in {secondsLeft}s
          </span>
        )}
      </div>
    </div>
  )
}
