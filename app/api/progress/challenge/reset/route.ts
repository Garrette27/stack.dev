import { NextResponse } from "next/server"
import { z } from "zod"

import { resetChallengeProgressForCurrentUser } from "@/lib/progress"

const resetChallengeSchema = z.object({
  courseSlug: z.string().min(3),
  lessonSlug: z.string().min(3),
  challengeSlug: z.string().min(3)
})

export async function POST(request: Request) {
  let json: unknown

  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid reset payload." }, { status: 400 })
  }

  const parsed = resetChallengeSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid reset payload." }, { status: 400 })
  }

  const result = await resetChallengeProgressForCurrentUser(parsed.data)
  return NextResponse.json(result.body, { status: result.status })
}
