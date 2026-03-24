import "server-only"

import { z } from "zod"

import { hasSupabaseEnv } from "@/lib/env"
import { mockResumeState } from "@/lib/mock-data"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { DashboardState, LessonProgress, ResumeState } from "@/lib/types"

import { getCurrentUser } from "@/lib/auth"
import { getContentSnapshot } from "@/lib/content"
import { sortLessons } from "@/lib/content/shared"

export const resumeSchema = z.object({
  courseSlug: z.string().min(3),
  lessonSlug: z.string().min(3)
})

export type ResumePayload = z.infer<typeof resumeSchema>

type ResumeSaveResult = {
  status: number
  body: {
    ok: boolean
    preview?: boolean
    message?: string
  }
}

type ServerSupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerClient>>>

function mapResumeState(row: Record<string, unknown>): ResumeState {
  return {
    userId: String(row.user_id),
    courseSlug: String(row.course_slug),
    lessonSlug: String(row.lesson_slug),
    updatedAt: String(row.updated_at)
  }
}

async function upsertResumeState(client: ServerSupabaseClient, userId: string, payload: ResumePayload) {
  await client.from("resume_state").upsert(
    {
      user_id: userId,
      course_slug: payload.courseSlug,
      lesson_slug: payload.lessonSlug,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  )
}

/**
 * Persists the current resume target for a known user id.
 */
export async function saveResumeStateForUser(
  client: ServerSupabaseClient,
  userId: string,
  payload: ResumePayload
): Promise<void> {
  await upsertResumeState(client, userId, payload)
}

/**
 * Persists the current resume target for the authenticated user behind a single
 * progress-domain API used by routes.
 */
export async function saveResumeStateForCurrentUser(payload: ResumePayload): Promise<ResumeSaveResult> {
  if (!hasSupabaseEnv()) {
    return {
      status: 200,
      body: { ok: true, preview: true }
    }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return {
      status: 200,
      body: { ok: true, preview: true }
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 401,
      body: { ok: false, message: "Authentication required." }
    }
  }

  await upsertResumeState(supabase, user.id, payload)

  return {
    status: 200,
    body: { ok: true }
  }
}

/**
 * Returns the learner dashboard state with progress and resume information.
 */
export async function getDashboardState(): Promise<DashboardState> {
  const snapshot = await getContentSnapshot()
  const user = await getCurrentUser()

  if (!user || !hasSupabaseEnv()) {
    return {
      courseCount: snapshot.courses.length,
      lessonCount: snapshot.lessons.length,
      completedLessons: 0,
      inProgressLessons: 0,
      resumeTarget: mockResumeState,
      recentLessons: snapshot.lessons.slice(0, 3).map((lesson) => ({
        ...lesson,
        courseTitle: snapshot.courses.find((course) => course.id === lesson.courseId)?.title ?? "",
        status: "not_started"
      }))
    }
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return {
      courseCount: snapshot.courses.length,
      lessonCount: snapshot.lessons.length,
      completedLessons: 0,
      inProgressLessons: 0,
      resumeTarget: null,
      recentLessons: []
    }
  }

  const [{ data: progressRows }, { data: resumeRow }] = await Promise.all([
    supabase.from("lesson_progress").select("*").eq("user_id", user.id),
    supabase.from("resume_state").select("*").eq("user_id", user.id).maybeSingle()
  ])

  const progressByLessonId = new Map(
    (progressRows ?? []).map((row) => {
      const progress = row as Record<string, unknown>
      return [
        String(progress.lesson_id),
        {
          lessonId: String(progress.lesson_id),
          userId: String(progress.user_id),
          status: String(progress.status ?? "not_started") as LessonProgress["status"],
          lastSubmissionId: progress.last_submission_id ? String(progress.last_submission_id) : null,
          completedAt: progress.completed_at ? String(progress.completed_at) : null,
          updatedAt: String(progress.updated_at)
        } satisfies LessonProgress
      ]
    })
  )

  const recentLessons = sortLessons(snapshot.lessons)
    .slice(0, 6)
    .map((lesson) => ({
      ...lesson,
      courseTitle: snapshot.courses.find((course) => course.id === lesson.courseId)?.title ?? "",
      status: progressByLessonId.get(lesson.id)?.status ?? "not_started"
    }))

  const progressValues = [...progressByLessonId.values()]

  return {
    courseCount: snapshot.courses.length,
    lessonCount: snapshot.lessons.length,
    completedLessons: progressValues.filter((item) => item.status === "completed").length,
    inProgressLessons: progressValues.filter((item) => item.status === "in_progress").length,
    resumeTarget: resumeRow ? mapResumeState(resumeRow as Record<string, unknown>) : null,
    recentLessons
  }
}
