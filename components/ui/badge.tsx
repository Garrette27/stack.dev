import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type BadgeProps = HTMLAttributes<HTMLSpanElement>

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-[var(--accent-badge-surface)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]",
        className
      )}
      {...props}
    />
  )
}
