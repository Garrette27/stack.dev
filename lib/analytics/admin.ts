import "server-only"

import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

export type AnalyticsRange = "24h" | "7d" | "30d"
export type AnalyticsAudience = "all" | "signed_in" | "anonymous"

export type AnalyticsBreakdownItem = {
  label: string
  count: number
}

export type AnalyticsTrendPoint = {
  label: string
  count: number
}

export type RecentVisit = {
  path: string
  viewedAt: string
  deviceLabel: string
  locationLabel: string
  visitorLabel: string
}

export type AdminAnalyticsSnapshot = {
  enabled: boolean
  range: AnalyticsRange
  audience: AnalyticsAudience
  totalVisits: number
  uniqueVisitors: number
  signedInVisits: number
  countriesReached: number
  trend: AnalyticsTrendPoint[]
  topPages: AnalyticsBreakdownItem[]
  topDevices: AnalyticsBreakdownItem[]
  topLocations: AnalyticsBreakdownItem[]
  topBrowsers: AnalyticsBreakdownItem[]
  recentVisits: RecentVisit[]
}

type PageVisitRow = {
  id: string
  user_id: string | null
  path: string | null
  referrer: string | null
  ip_hash: string | null
  country: string | null
  region: string | null
  city: string | null
  device_type: string | null
  browser: string | null
  operating_system: string | null
  viewed_at: string | null
}

function createEmptySnapshot(range: AnalyticsRange, audience: AnalyticsAudience, enabled: boolean): AdminAnalyticsSnapshot {
  return {
    enabled,
    range,
    audience,
    totalVisits: 0,
    uniqueVisitors: 0,
    signedInVisits: 0,
    countriesReached: 0,
    trend: [],
    topPages: [],
    topDevices: [],
    topLocations: [],
    topBrowsers: [],
    recentVisits: []
  }
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

function getRangeStart(range: AnalyticsRange) {
  const now = Date.now()

  if (range === "24h") {
    return new Date(now - 24 * 60 * 60 * 1000)
  }

  if (range === "30d") {
    return new Date(now - 30 * 24 * 60 * 60 * 1000)
  }

  return new Date(now - 7 * 24 * 60 * 60 * 1000)
}

function countTopItems(values: string[], limit = 5): AnalyticsBreakdownItem[] {
  const counts = new Map<string, number>()

  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function getLocationLabel(row: PageVisitRow) {
  const city = row.city?.trim()
  const region = row.region?.trim()
  const country = row.country?.trim()

  if (city && country) {
    return `${city}, ${country}`
  }

  if (region && country) {
    return `${region}, ${country}`
  }

  if (country) {
    return country
  }

  return "Unknown location"
}

function getDeviceLabel(row: PageVisitRow) {
  const deviceType = row.device_type?.trim()
  const browser = row.browser?.trim()

  if (deviceType && browser) {
    return `${deviceType} - ${browser}`
  }

  if (deviceType) {
    return deviceType
  }

  if (browser) {
    return browser
  }

  return "Unknown device"
}

function getVisitorKey(row: PageVisitRow) {
  if (row.user_id) {
    return `user:${row.user_id}`
  }

  if (row.ip_hash) {
    return `anon:${row.ip_hash}`
  }

  return `visit:${row.id}`
}

function getVisitorLabel(row: PageVisitRow) {
  return row.user_id ? "Signed in" : "Anonymous"
}

function matchesAudience(row: PageVisitRow, audience: AnalyticsAudience) {
  if (audience === "signed_in") {
    return Boolean(row.user_id)
  }

  if (audience === "anonymous") {
    return !row.user_id
  }

  return true
}

function formatTrendLabel(date: Date, range: AnalyticsRange) {
  return new Intl.DateTimeFormat(
    "en-PH",
    range === "24h" ? { hour: "numeric" } : { month: "short", day: "numeric" }
  ).format(date)
}

function buildTrend(rows: PageVisitRow[], range: AnalyticsRange): AnalyticsTrendPoint[] {
  const now = new Date()

  if (range === "24h") {
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = new Date(now.getTime() - (5 - index) * 4 * 60 * 60 * 1000)
      const bucketEnd = new Date(bucketStart.getTime() + 4 * 60 * 60 * 1000)

      return {
        label: formatTrendLabel(bucketStart, range),
        count: rows.filter((row) => {
          const viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : 0
          return viewedAt >= bucketStart.getTime() && viewedAt < bucketEnd.getTime()
        }).length
      }
    })
  }

  const bucketCount = range === "30d" ? 10 : 7
  const bucketSizeInDays = range === "30d" ? 3 : 1

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(now.getTime() - (bucketCount - 1 - index) * bucketSizeInDays * 24 * 60 * 60 * 1000)
    const bucketEnd = new Date(bucketStart.getTime() + bucketSizeInDays * 24 * 60 * 60 * 1000)

    return {
      label: formatTrendLabel(bucketStart, range),
      count: rows.filter((row) => {
        const viewedAt = row.viewed_at ? new Date(row.viewed_at).getTime() : 0
        return viewedAt >= bucketStart.getTime() && viewedAt < bucketEnd.getTime()
      }).length
    }
  })
}

/**
 * Returns an admin-friendly analytics snapshot from recent page visits without
 * leaking table-level details into the admin page.
 */
export async function getAdminAnalyticsSnapshot(options?: {
  range?: AnalyticsRange
  audience?: AnalyticsAudience
}): Promise<AdminAnalyticsSnapshot> {
  const range = options?.range ?? "7d"
  const audience = options?.audience ?? "all"

  if (!hasSupabaseAdminEnv()) {
    return createEmptySnapshot(range, audience, false)
  }

  const admin = createAdminClient()
  if (!admin) {
    return createEmptySnapshot(range, audience, false)
  }

  const { data, error } = await admin
    .from("page_visits")
    .select("id,user_id,path,referrer,ip_hash,country,region,city,device_type,browser,operating_system,viewed_at")
    .gte("viewed_at", getRangeStart(range).toISOString())
    .order("viewed_at", { ascending: false })
    .limit(1000)

  if (isMissingTableError(error)) {
    return createEmptySnapshot(range, audience, false)
  }

  if (error || !data) {
    return createEmptySnapshot(range, audience, true)
  }

  const rows = (data as PageVisitRow[]).filter((row) => matchesAudience(row, audience))
  const uniqueVisitors = new Set(rows.map(getVisitorKey)).size
  const signedInVisits = rows.filter((row) => Boolean(row.user_id)).length
  const countriesReached = new Set(rows.map((row) => row.country?.trim()).filter(Boolean)).size

  return {
    enabled: true,
    range,
    audience,
    totalVisits: rows.length,
    uniqueVisitors,
    signedInVisits,
    countriesReached,
    trend: buildTrend(rows, range),
    topPages: countTopItems(rows.map((row) => row.path?.trim() || "(unknown page)")),
    topDevices: countTopItems(rows.map((row) => row.device_type?.trim() || "unknown")),
    topLocations: countTopItems(rows.map(getLocationLabel)),
    topBrowsers: countTopItems(rows.map((row) => row.browser?.trim() || "unknown")),
    recentVisits: rows.slice(0, 12).map((row) => ({
      path: row.path?.trim() || "(unknown page)",
      viewedAt: row.viewed_at || new Date().toISOString(),
      deviceLabel: getDeviceLabel(row),
      locationLabel: getLocationLabel(row),
      visitorLabel: getVisitorLabel(row)
    }))
  }
}
