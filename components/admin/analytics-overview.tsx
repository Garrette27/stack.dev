import Link from "next/link"
import { Activity, Globe2, LaptopMinimal, MonitorSmartphone } from "lucide-react"

import { RecentVisitsPanel } from "@/components/admin/recent-visits-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AdminAnalyticsSnapshot, AnalyticsAudience, AnalyticsRange } from "@/lib/analytics"

type AnalyticsOverviewProps = {
  snapshot: AdminAnalyticsSnapshot
}

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" }
]

const AUDIENCE_OPTIONS: Array<{ value: AnalyticsAudience; label: string }> = [
  { value: "all", label: "All visitors" },
  { value: "signed_in", label: "Signed in" },
  { value: "anonymous", label: "Anonymous" }
]

function buildAnalyticsHref(range: AnalyticsRange, audience: AnalyticsAudience) {
  return `/admin?analyticsRange=${range}&analyticsAudience=${audience}`
}

function FilterPill({
  active,
  href,
  label
}: {
  active: boolean
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
        active
          ? "border-[var(--accent-soft)] bg-[var(--accent)] text-white shadow-[0_10px_22px_rgba(201,111,54,0.24)]"
          : "border-white/20 bg-[rgba(255,255,255,0.14)] text-white/85 hover:border-white/30 hover:bg-[rgba(255,255,255,0.2)] hover:text-white"
      )}
    >
      {label}
    </Link>
  )
}

function BreakdownList({
  title,
  description,
  items
}: {
  title: string
  description: string
  items: Array<{ label: string; count: number }>
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1)

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="grid gap-2 rounded-[1rem] bg-[var(--surface-hover)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-[var(--ink)]">{item.label}</span>
                <span className="shrink-0 text-sm font-semibold text-[var(--ink-strong)]">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border-soft)]">
                <div
                  className="h-2 rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.max((item.count / maxCount) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-muted)]">No tracking data yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function TrendChart({ points }: { points: AdminAnalyticsSnapshot["trend"] }) {
  const maxCount = Math.max(...points.map((point) => point.count), 1)

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Visit trend</CardTitle>
            <CardDescription>Traffic shape over the selected time range.</CardDescription>
          </div>
          <Badge>Operations view</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {points.length ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(56px,1fr))] items-end gap-3">
            {points.map((point) => (
              <div key={point.label} className="grid gap-2">
                <div className="flex h-40 items-end justify-center rounded-[1rem] bg-[var(--surface-hover)] px-2 py-3">
                  <div
                    className="w-full rounded-full bg-[linear-gradient(180deg,rgba(219,145,80,0.9),rgba(201,111,54,1))]"
                    style={{ height: `${Math.max((point.count / maxCount) * 100, point.count ? 10 : 4)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--ink-strong)]">{point.count}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{point.label}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-muted)]">No trend data yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Presents page-hit analytics in admin terms without exposing storage details.
 */
export function AnalyticsOverview({ snapshot }: AnalyticsOverviewProps) {
  if (!snapshot.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audience signals</CardTitle>
          <CardDescription>
            Device and location tracking will appear here after the `page_visits` table is available and traffic starts
            flowing.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden bg-[linear-gradient(160deg,rgba(25,31,45,0.96),rgba(45,55,72,0.92))] text-white">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">Audience signals</CardTitle>
              <CardDescription className="text-white/75">
                Device and location tracking for the learner-facing product.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <FilterPill
                  key={option.value}
                  active={snapshot.range === option.value}
                  href={buildAnalyticsHref(option.value, snapshot.audience)}
                  label={option.label}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((option) => (
              <FilterPill
                key={option.value}
                active={snapshot.audience === option.value}
                href={buildAnalyticsHref(snapshot.range, option.value)}
                label={option.label}
              />
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full">
          <CardHeader className="h-full justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Activity className="h-4 w-4" />
              <CardDescription>{snapshot.range === "24h" ? "Current day view" : snapshot.range === "30d" ? "Last 30 days" : "Last 7 days"}</CardDescription>
            </div>
            <CardTitle>{snapshot.totalVisits}</CardTitle>
            <CardDescription>Total visits</CardDescription>
          </CardHeader>
        </Card>
        <Card className="h-full">
          <CardHeader className="h-full justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <MonitorSmartphone className="h-4 w-4" />
              <CardDescription>Approximate people</CardDescription>
            </div>
            <CardTitle>{snapshot.uniqueVisitors}</CardTitle>
            <CardDescription>Unique visitors</CardDescription>
          </CardHeader>
        </Card>
        <Card className="h-full">
          <CardHeader className="h-full justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <LaptopMinimal className="h-4 w-4" />
              <CardDescription>Known accounts</CardDescription>
            </div>
            <CardTitle>{snapshot.signedInVisits}</CardTitle>
            <CardDescription>Signed-in visits</CardDescription>
          </CardHeader>
        </Card>
        <Card className="h-full">
          <CardHeader className="h-full justify-between">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Globe2 className="h-4 w-4" />
              <CardDescription>Approximate reach</CardDescription>
            </div>
            <CardTitle>{snapshot.countriesReached}</CardTitle>
            <CardDescription>Countries reached</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <TrendChart points={snapshot.trend} />
        <BreakdownList
          title="Top pages"
          description="Which routes people open most often."
          items={snapshot.topPages}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <BreakdownList
          title="Devices"
          description="The device types showing up on the site."
          items={snapshot.topDevices}
        />
        <BreakdownList
          title="Locations"
          description="Approximate location from hosting headers."
          items={snapshot.topLocations}
        />
        <BreakdownList
          title="Browsers"
          description="Useful when you start troubleshooting UI issues."
          items={snapshot.topBrowsers}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent visits</CardTitle>
          <CardDescription>
            Full visit history for the selected range with approximate device and location signals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.recentVisits.length ? (
            <RecentVisitsPanel
              key={`${snapshot.range}-${snapshot.audience}`}
              range={snapshot.range}
              audience={snapshot.audience}
              initialVisits={snapshot.recentVisits}
              initialHasMore={snapshot.hasMoreRecentVisits}
            />
          ) : (
            <p className="text-sm leading-7 text-[var(--ink-muted)]">No visits have been recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
