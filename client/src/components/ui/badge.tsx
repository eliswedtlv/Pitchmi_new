import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Soft-tint semantics (T-10022). In dark the `-soft` tokens are low-alpha
// overlays rather than pale tints — a `-100` step disappears entirely on a
// near-black surface — and the `-fg` text is the lighter, less saturated end of
// each hue. Every pair holds AA in both schemes.
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-micro font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg",
        secondary: "border border-line bg-raised text-fg-muted",
        destructive: "bg-bad-soft text-bad-fg",
        warning: "bg-warn-soft text-warn-fg",
        success: "bg-good-soft text-good-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
