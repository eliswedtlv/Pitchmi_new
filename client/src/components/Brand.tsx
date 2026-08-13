import { cn } from "@/lib/utils"

interface BrandProps {
  markOnly?: boolean
  className?: string
  inverse?: boolean
}

/**
 * KillerPitch's cut-through K. The separated strokes keep the mark crisp at
 * favicon size while the forward diagonals suggest a cue moving into delivery.
 * The same object works in app chrome and over a live camera feed.
 */
export function Brand({ markOnly = false, className, inverse = false }: BrandProps) {
  return (
    <span
      aria-label={markOnly ? "KillerPitch" : undefined}
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
            d="M7.25 5.5v13M18.25 5.75 9.8 12M12.2 10.35 18.7 18.4"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
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
          killerpitch
        </span>
      )}
    </span>
  )
}
