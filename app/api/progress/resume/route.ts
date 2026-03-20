import { NextResponse } from "next/server"
import { z } from "zod"

import { hasSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

const resumeSchema = z.object({
  courseSlug: z.string().min(3),
  lessonSlug: z.string().min(3)
})

export async function POST(request: Request) {
  const payload = resumeSchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, preview: true })
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } }

  if (!user) {
    return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 })
  }

  await supabase!.from("resume_state").upsert(
    {
      user_id: user.id,
      course_slug: payload.data.courseSlug,
      lesson_slug: payload.data.lessonSlug,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  )

  return NextResponse.json({ ok: true })
}
