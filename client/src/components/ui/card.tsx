import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // No shadow, by policy (T-10022): depth is canvas → surface → raised plus
      // a 1px border. A shadow is invisible on a near-black canvas, so a card
      // that leaned on `shadow-sm` for separation would simply vanish in dark.
      className={cn("rounded-panel border border-line bg-surface", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-meta font-medium uppercase tracking-[0.08em] text-fg-subtle", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
