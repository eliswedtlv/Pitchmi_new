import { cn } from "@/lib/utils"

interface BrandProps {
  markOnly?: boolean
  className?: string
  inverse?: boolean
}

/**
 * PitchMi's rising-voice mark: three bars for voice, pace and improvement.
 * It stays deliberately simple so the same object works in app chrome, over a
 * camera feed and at favicon scale without a second "compact" identity.
 */
export function Brand({ markOnly = false, className, inverse = false }: BrandProps) {
  return (
    <span
      aria-label={markOnly ? "PitchMi" : undefined}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <span
        aria-hidden={!markOnly}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent text-accent-fg",
          inverse && "ring-1 ring-white/20",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <path
            d="M6.5 16.5v-4M12 16.5v-8M17.5 16.5V5.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!markOnly && (
        <span
          className={cn(
            "text-[1.05rem] font-semibold tracking-[-0.035em] text-fg",
            inverse && "text-media-fg",
          )}
        >
          pitchmi
        </span>
      )}
    </span>
  )
}
