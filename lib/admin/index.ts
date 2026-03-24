import { hasSupabaseAdminEnv } from "@/lib/env"
import { mockContent } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Challenge, ContentSnapshot } from "@/lib/types"

import { createMockSnapshot, mapChallenge, mapCourse, mapLesson } from "@/lib/content/shared"

export async function getRunnerChallengeBySlug(challengeSlug: string): Promise<Challenge | null> {
  if (!hasSupabaseAdminEnv()) {
    return mockContent.challenges.find((item) => item.slug === challengeSlug) ?? null
  }

  const admin = createAdminClient()
  const { data } = await admin!.from("challenges").select("*").eq("slug", challengeSlug).maybeSingle()

  if (!data) {
    return null
  }

  return mapChallenge(data as Record<string, unknown>)
}

export async function getAdminSnapshot(): Promise<ContentSnapshot> {
  if (!hasSupabaseAdminEnv()) {
    return createMockSnapshot("Supabase service-role env is missing, so admin is showing preview content.")
  }

  const admin = createAdminClient()
  const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }] = await Promise.all([
    admin!.from("courses").select("*").order("title"),
    admin!.from("lessons").select("*").order("order_index"),
    admin!.from("challenges").select("*").order("title")
  ])

  const courses = (courseRows ?? []).map((row) => mapCourse(row as Record<string, unknown>))
  const courseSlugById = new Map(courses.map((course) => [course.id, course.slug]))
  const lessons = (lessonRows ?? []).map((row) =>
    mapLesson(row as Record<string, unknown>, courseSlugById.get(String((row as Record<string, unknown>).course_id)) ?? "")
  )
  const challenges = (challengeRows ?? []).map((row) => mapChallenge(row as Record<string, unknown>))

  return {
    courses,
    lessons,
    challenges,
    contentSource: "database",
    contentSourceReason:
      courses.length || lessons.length || challenges.length
        ? "Admin is reading live Supabase rows."
        : "Admin is connected to Supabase, but there are no authored rows yet."
  }
}
