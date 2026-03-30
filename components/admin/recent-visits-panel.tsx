"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LoaderCircle, MapPinned } from "lucide-react"

import type { AnalyticsAudience, AnalyticsRange, RecentVisit } from "@/lib/analytics"

type RecentVisitsPanelProps = {
  range: AnalyticsRange
  audience: AnalyticsAudience
  initialVisits: RecentVisit[]
  initialHasMore: boolean
}

function formatVisitTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

/**
 * Keeps recent-visit pagination local to one client component so the admin
 * overview can stay declarative while long histories load on demand.
 */
export function RecentVisitsPanel({
  range,
  audience,
  initialVisits,
  initialHasMore
}: RecentVisitsPanelProps) {
  const [visits, setVisits] = useState(initialVisits)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestKey = useMemo(() => `${range}:${audience}`, [audience, range])

  useEffect(() => {
    setVisits(initialVisits)
    setPage(0)
    setHasMore(initialHasMore)
    setIsLoading(false)
  }, [initialHasMore, initialVisits, requestKey])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return
    }

    setIsLoading(true)

    try {
      const nextPage = page + 1
      const response = await fetch(
        `/api/admin/analytics/recent-visits?range=${range}&audience=${audience}&page=${nextPage}`,
        {
          method: "GET",
          cache: "no-store"
        }
      )

      if (!response.ok) {
        setHasMore(false)
        return
      }

      const payload = (await response.json()) as {
        ok?: boolean
        visits?: RecentVisit[]
        hasMore?: boolean
      }

      if (!payload.ok) {
        setHasMore(false)
        return
      }

      const nextVisits = payload.visits ?? []
      setVisits((current) => [...current, ...nextVisits])
      setPage(nextPage)
      setHasMore(Boolean(payload.hasMore))
    } finally {
      setIsLoading(false)
    }
  }, [audience, hasMore, isLoading, page, range])

  useEffect(() => {
    if (!scrollRootRef.current || !sentinelRef.current || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      {
        root: scrollRootRef.current,
        rootMargin: "180px"
      }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore, requestKey])

  if (!visits.length) {
    return <p className="text-sm leading-7 text-[var(--ink-muted)]">No visits have been recorded yet.</p>
  }

  return (
    <div ref={scrollRootRef} className="max-h-[42rem] overflow-y-auto pr-2">
      <div className="space-y-3">
        {visits.map((visit, index) => (
          <div
            key={`${visit.path}-${visit.viewedAt}-${visit.deviceLabel}-${index}`}
            className="grid gap-2 rounded-[1rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">{visit.path}</p>
              <p className="text-xs text-[var(--ink-muted)]">{visit.visitorLabel}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--ink)]">{visit.deviceLabel}</p>
              <p className="truncate text-xs text-[var(--ink-muted)]">
                <MapPinned className="mr-1 inline h-3 w-3" />
                {visit.locationLabel}
              </p>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">{formatVisitTime(visit.viewedAt)}</p>
          </div>
        ))}

        <div ref={sentinelRef} className="flex items-center justify-center py-2">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading more visits
            </span>
          ) : hasMore ? (
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">Scroll to load older visits</span>
          ) : (
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">Start of selected history reached</span>
          )}
        </div>
      </div>
    </div>
  )
}
