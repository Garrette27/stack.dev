import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type FieldProps = {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-sm font-semibold text-[var(--ink-strong)]">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-[var(--ink-muted)]">{hint}</span> : null}
    </label>
  )
}
