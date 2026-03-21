import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink-strong)] px-5 py-3 text-[var(--surface)] shadow-[0_12px_32px_rgba(25,31,45,0.18)] hover:bg-[color:rgb(25_31_45/0.9)]",
        secondary:
          "bg-white px-5 py-3 text-[var(--ink-strong)] ring-1 ring-black/10 hover:bg-[color:rgb(255_255_255/0.7)]",
        ghost: "px-4 py-2.5 text-[var(--ink)] hover:bg-black/5",
        accent:
          "bg-[var(--accent)] px-5 py-3 text-white shadow-[0_16px_40px_rgba(201,111,54,0.35)] hover:bg-[color:rgb(201_111_54/0.92)]"
      },
      size: {
        default: "",
        sm: "px-3 py-2 text-xs",
        lg: "px-6 py-3.5 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
