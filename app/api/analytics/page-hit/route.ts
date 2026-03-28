import { NextResponse } from "next/server"

import { parsePageHitPayload, recordPageHit } from "@/lib/analytics"

export async function POST(request: Request) {
  let json: unknown

  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, tracked: false }, { status: 400 })
  }

  const parsed = parsePageHitPayload(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, tracked: false }, { status: 400 })
  }

  const result = await recordPageHit(request, parsed.data)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
