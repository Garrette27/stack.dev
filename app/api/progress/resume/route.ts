import { NextResponse } from "next/server"

import { resumeSchema, saveResumeStateForCurrentUser } from "@/lib/progress"

export async function POST(request: Request) {
  let json: unknown

  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const parsed = resumeSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const result = await saveResumeStateForCurrentUser(parsed.data)
  return NextResponse.json(result.body, { status: result.status })
}
