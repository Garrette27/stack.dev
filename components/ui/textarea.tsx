import * as React from "react"

import { cn } from "@/lib/utils"

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-32 w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"
