import * as React from "react"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-surface-card=""
      className={cn(
        "min-w-0 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] shadow-[0_24px_60px_var(--card-shadow)] backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 space-y-3 p-6 sm:p-7", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "min-w-0 break-words text-xl font-semibold leading-tight tracking-tight text-[var(--ink-strong)] [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("break-words text-sm leading-7 text-[var(--ink-muted)]", className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-6 pt-0 sm:p-7 sm:pt-0", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-6 pt-0 sm:p-7 sm:pt-0", className)} {...props} />
}
