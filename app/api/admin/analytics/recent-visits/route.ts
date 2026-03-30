import { NextResponse } from "next/server"
import { z } from "zod"

import { isCurrentUserAdmin } from "@/lib/auth"
import {
  getAdminRecentVisitsPage,
  normalizeAnalyticsAudience,
  normalizeAnalyticsRange
} from "@/lib/analytics"

const recentVisitQuerySchema = z.object({
  range: z.string().optional(),
  audience: z.string().optional(),
  page: z.coerce.number().int().min(0).optional()
})

/**
 * Streams paged recent-visit history for admins so the page can lazy-load
 * older rows without embedding analytics query details in the UI.
 */
export async function GET(request: Request) {
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, message: "Not authorized." }, { status: 403 })
  }

  const parsed = recentVisitQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid analytics query." }, { status: 400 })
  }

  const page = await getAdminRecentVisitsPage({
    range: normalizeAnalyticsRange(parsed.data.range),
    audience: normalizeAnalyticsAudience(parsed.data.audience),
    page: parsed.data.page ?? 0
  })

  return NextResponse.json({ ok: true, ...page })
}
