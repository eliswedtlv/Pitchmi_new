"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

// Tokens, not palette steps (T-10022) — so every variant follows the OS colour
// scheme, and so the camera screens can pin the dark values with `.scheme-dark`
// and get the same buttons. Variant NAMES are load-bearing: five screens call
// them by name, so they are kept even where the treatment changed.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control text-meta font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // The one filled action, and now the loudest of the three places the
        // brand accent is spent (T-10024). T-10022 made this near-black on the
        // reasoning that no accent at all keeps green/amber/red meaning "score
        // band" and nothing else. The reasoning holds; the conclusion overshot,
        // and left a product with correct typography and no identity. The
        // accent sits nowhere near the score arc, so the discipline survives:
        // still exactly one filled button per screen, still never a score
        // colour. See docs/design-direction.md §T-10024.
        default: "bg-accent text-accent-fg hover:opacity-90",
        destructive: "bg-danger text-danger-fg hover:opacity-90",
        outline: "border border-line-strong bg-surface text-fg hover:bg-raised",
        ghost: "text-fg hover:bg-raised",
        secondary: "border border-line bg-raised text-fg hover:border-line-strong",
        // Tinted rather than filled: under this direction a saturated green
        // means "score ≥ 80", and a permanently green button would teach the
        // user that the colour means nothing (see docs/design-direction.md).
        success: "border border-good/30 bg-good-soft text-good-fg hover:border-good/60",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-micro",
        lg: "h-12 px-6 text-body",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
