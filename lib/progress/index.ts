import "server-only"

import { z } from "zod"

import { hasSupabaseEnv } from "@/lib/env"
import { mockResumeState } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { DashboardState, LessonProgress, ResumeState } from "@/lib/types"

import { getCurrentUser } from "@/lib/auth"
import { getContentSnapshot } from "@/lib/content"
import { sortLessons } from "@/lib/content/shared"
import type { Challenge } from "@/lib/types"

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

type ChallengeProgressResetPayload = {
  courseSlug: string
  lessonSlug: string
  challengeSlug: string
}

type ChallengeProgressResetResult = {
  status: number
  body: {
    ok: boolean
    message?: string
  }
}

type ServerSupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerClient>>>
type ProgressStoreClient = Pick<ServerSupabaseClient, "from">

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

async function recalculateLessonProgress(
  client: ProgressStoreClient,
  userId: string,
  lessonId: string,
  lessonChallengeIds: string[]
) {
  const { data: remainingSubmissions } = await client
    .from("submissions")
    .select("id,passed,created_at,challenge_id")
    .eq("user_id", userId)
    .in("challenge_id", lessonChallengeIds)
    .order("created_at", { ascending: false })

  const submissions = (remainingSubmissions ?? []).map((row) => ({
    id: String(row.id),
    passed: Boolean(row.passed)
  }))

  const latestSubmissionId = submissions[0]?.id ?? null
  const hasAnySubmission = submissions.length > 0
  const hasPassedSubmission = submissions.some((submission) => submission.passed)

  if (!hasAnySubmission) {
    const { error } = await client.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId)

    if (error) {
      throw new Error(`Could not clear lesson progress: ${error.message}`)
    }

    return
  }

  const { error } = await client.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      last_submission_id: latestSubmissionId,
      status: hasPassedSubmission ? "completed" : "in_progress",
      completed_at: hasPassedSubmission ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,lesson_id"
    }
  )

  if (error) {
    throw new Error(`Could not update lesson progress: ${error.message}`)
  }
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
 * Removes the current user's passed marker for one assignment and recalculates
 * lesson progress so the learner can intentionally clear completion state.
 */
export async function resetChallengeProgressForCurrentUser(
  payload: ChallengeProgressResetPayload
): Promise<ChallengeProgressResetResult> {
  const user = await getCurrentUser()

  if (!user || !hasSupabaseEnv()) {
    return {
      status: 401,
      body: { ok: false, message: "Authentication required." }
    }
  }

  const snapshot = await getContentSnapshot()
  const course = snapshot.courses.find((item) => item.slug === payload.courseSlug)
  const lesson = snapshot.lessons.find((item) => item.courseId === course?.id && item.slug === payload.lessonSlug)
  const challenge = snapshot.challenges.find((item) => item.slug === payload.challengeSlug)

  if (!course || !lesson || !challenge || !lesson.challengeIds.includes(challenge.id)) {
    return {
      status: 404,
      body: { ok: false, message: "Assignment not found." }
    }
  }

  const client = createAdminClient() ?? (await createServerClient())
  if (!client) {
    return {
      status: 500,
      body: { ok: false, message: "Progress service unavailable." }
    }
  }

  const { data: deletedSubmissions, error: deleteError } = await client
    .from("submissions")
    .delete()
    .eq("user_id", user.id)
    .eq("challenge_id", challenge.id)
    .eq("passed", true)
    .select("id")

  if (deleteError) {
    return {
      status: 500,
      body: { ok: false, message: "Could not clear progress for this assignment." }
    }
  }

  try {
    await recalculateLessonProgress(client, user.id, lesson.id, lesson.challengeIds)
  } catch {
    return {
      status: 500,
      body: { ok: false, message: "Could not refresh lesson progress after clearing this assignment." }
    }
  }

  return {
    status: 200,
    body: { ok: true, message: deletedSubmissions?.length ? undefined : "No stored pass mark was found for this assignment." }
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

/**
 * Returns the challenge slugs the current user has already passed so learner
 * navigation can show assignment-level completion without exposing submission
 * storage details to pages.
 */
export async function getCompletedChallengeSlugs(challenges: Challenge[]): Promise<string[]> {
  if (!challenges.length) {
    return []
  }

  const user = await getCurrentUser()
  if (!user || !hasSupabaseEnv()) {
    return []
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return []
  }

  const challengeSlugById = new Map(challenges.map((challenge) => [challenge.id, challenge.slug]))
  const challengeIds = challenges.map((challenge) => challenge.id)

  const { data } = await supabase
    .from("submissions")
    .select("challenge_id")
    .eq("user_id", user.id)
    .eq("passed", true)
    .in("challenge_id", challengeIds)

  return [...new Set((data ?? []).map((row) => challengeSlugById.get(String(row.challenge_id))).filter(Boolean))] as string[]
}
