"use client"

import { useEffect, useState } from "react"
import { MoonStar, SunMedium } from "lucide-react"

import {
  APP_THEME_STORAGE_KEY,
  getOppositeAppTheme,
  getThemeToggleLabel,
  isAppTheme,
  type AppTheme
} from "@/lib/theme"

function readDocumentTheme(): AppTheme {
  if (typeof document === "undefined") {
    return "dark"
  }

  const theme = document.documentElement.dataset.theme
  return isAppTheme(theme) ? theme : "dark"
}

function persistTheme(theme: AppTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
}

/**
 * Keeps the header toggle tiny while hiding localStorage and document updates
 * behind one focused client component.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(readDocumentTheme())
    setMounted(true)
  }, [])

  const nextTheme = getOppositeAppTheme(theme)
  const isDarkTheme = mounted ? theme === "dark" : false

  return (
    <button
      type="button"
      onClick={() => {
        persistTheme(nextTheme)
        setTheme(nextTheme)
      }}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-strong)] px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-strong)] shadow-[0_10px_26px_var(--card-shadow)] transition hover:bg-[var(--surface)]"
    >
      {isDarkTheme ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      <span suppressHydrationWarning>{getThemeToggleLabel(theme)}</span>
    </button>
  )
}
