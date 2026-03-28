"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Sends one lightweight page-hit event for each client-side navigation.
 */
export function PageHitTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastTrackedPathRef = useRef("")

  useEffect(() => {
    const query = searchParams.toString()
    const currentPath = query ? `${pathname}?${query}` : pathname

    if (!currentPath || lastTrackedPathRef.current === currentPath) {
      return
    }

    lastTrackedPathRef.current = currentPath

    void fetch("/api/analytics/page-hit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: currentPath,
        referrer: document.referrer || null
      }),
      keepalive: true
    })
  }, [pathname, searchParams])

  return null
}
