"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"

import { renderHighlightedCode } from "@/lib/code-highlighting"

type ReadOnlyCodePanelProps = {
  code: string
  language: string | null
  tone: "light" | "dark"
  className: string
  headerClassName: string
}

/**
 * Renders a read-only highlighted code block with a compact copy affordance,
 * keeping lesson examples consistent without exposing clipboard details to MDX callers.
 */
export function ReadOnlyCodePanel({
  code,
  language,
  tone,
  className,
  headerClassName
}: ReadOnlyCodePanelProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false)
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`mt-6 overflow-hidden rounded-[1.5rem] border ${className}`}>
      <div className={`flex items-center justify-end border-b px-3 py-2 ${headerClassName}`}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Code copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-sm">
        {renderHighlightedCode(code, language, tone)}
      </pre>
    </div>
  )
}
