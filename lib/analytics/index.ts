import "server-only"

import { createHash } from "node:crypto"

import { z } from "zod"

import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"

const pageHitSchema = z.object({
  path: z.string().min(1),
  referrer: z.string().trim().optional().nullable()
})

export type PageHitPayload = z.infer<typeof pageHitSchema>

type DeviceContext = {
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown"
  browser: string | null
  operatingSystem: string | null
}

type GeoContext = {
  country: string | null
  region: string | null
  city: string | null
}

export type PageHitResult = {
  ok: boolean
  tracked: boolean
}

function detectDeviceContext(userAgent: string): DeviceContext {
  const normalized = userAgent.toLowerCase()

  if (!normalized) {
    return { deviceType: "unknown", browser: null, operatingSystem: null }
  }

  const deviceType =
    /bot|crawler|spider|headless/.test(normalized)
      ? "bot"
      : /ipad|tablet/.test(normalized)
        ? "tablet"
        : /mobile|iphone|android/.test(normalized)
          ? "mobile"
          : "desktop"

  const browser =
    /edg\//.test(normalized)
      ? "Edge"
      : /chrome\//.test(normalized)
        ? "Chrome"
        : /firefox\//.test(normalized)
          ? "Firefox"
          : /safari\//.test(normalized) && !/chrome\//.test(normalized)
            ? "Safari"
            : /opr\//.test(normalized)
              ? "Opera"
              : null

  const operatingSystem =
    /windows/.test(normalized)
      ? "Windows"
      : /mac os|macintosh/.test(normalized)
        ? "macOS"
        : /android/.test(normalized)
          ? "Android"
          : /iphone|ipad|ios/.test(normalized)
            ? "iOS"
            : /linux/.test(normalized)
              ? "Linux"
              : null

  return {
    deviceType,
    browser,
    operatingSystem
  }
}

function readGeoContext(headers: Headers): GeoContext {
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: headers.get("x-vercel-ip-city")
  }
}

function hashIpAddress(headers: Headers) {
  const rawIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip")?.trim() ??
    ""

  if (!rawIp) {
    return null
  }

  return createHash("sha256")
    .update(`${process.env.TRACKING_SALT ?? "stack-dev"}:${rawIp}`)
    .digest("hex")
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

/**
 * Validates a page-hit payload before it reaches storage.
 */
export function parsePageHitPayload(input: unknown) {
  return pageHitSchema.safeParse(input)
}

/**
 * Records an anonymized page hit using geolocation headers when available.
 * The provider-specific lookup stays hidden here so the rest of the app only
 * deals with a single tracking entry point.
 */
export async function recordPageHit(request: Request, payload: PageHitPayload): Promise<PageHitResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, tracked: false }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: true, tracked: false }
  }

  const supabase = await createServerClient()
  const user =
    supabase
      ? (
          await supabase.auth.getUser()
        ).data.user
      : null

  const headers = request.headers
  const userAgent = headers.get("user-agent") ?? ""
  const device = detectDeviceContext(userAgent)
  const geo = readGeoContext(headers)
  const ipHash = hashIpAddress(headers)

  const { error } = await admin.from("page_visits").insert({
    user_id: user?.id ?? null,
    path: normalizePath(payload.path),
    referrer: payload.referrer || null,
    ip_hash: ipHash,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    device_type: device.deviceType,
    browser: device.browser,
    operating_system: device.operatingSystem,
    metadata: {
      userAgent
    }
  })

  if (isMissingTableError(error)) {
    return { ok: true, tracked: false }
  }

  if (error) {
    return { ok: false, tracked: false }
  }

  return { ok: true, tracked: true }
}
