import * as React from "react"

import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
