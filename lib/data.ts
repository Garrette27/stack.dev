import { cache } from "react"

import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/env"
import { mockContent, mockResumeState } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type {
  Challenge,
  ContentSnapshot,
  Course,
  CourseWithLessons,
  DashboardState,
  Lesson,
  LessonBundle,
  LessonProgress,
  ResumeState
} from "@/lib/types"

function createMockSnapshot(reason: string): ContentSnapshot {
  return {
    ...mockContent,
    contentSource: "mock",
    contentSourceReason: reason
  }
}

function sortLessons(lessons: Lesson[]) {
  return [...lessons].sort((a, b) => a.orderIndex - b.orderIndex)
}

function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    difficulty: String(row.difficulty ?? "Beginner"),
    accent: String(row.accent ?? "#c96f36"),
    published: Boolean(row.published ?? true)
  }
}

function mapLesson(row: Record<string, unknown>, courseSlug: string): Lesson {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    courseSlug,
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    estimatedMinutes: Number(row.estimated_minutes ?? 10),
    bodyMdx: String(row.body_mdx ?? ""),
    challengeSlug: row.challenge_slug ? String(row.challenge_slug) : null,
    orderIndex: Number(row.order_index ?? 1),
    published: Boolean(row.published ?? true)
  }
}

function mapChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    language: row.language === "javascript" ? "javascript" : "python",
    judge0LanguageId: Number(row.judge0_language_id ?? 71),
    promptMdx: String(row.prompt_mdx ?? ""),
    starterCode: String(row.starter_code ?? ""),
    solutionCode: String(row.solution_code ?? ""),
    hiddenTestCode: String(row.hidden_test_code ?? ""),
    published: Boolean(row.published ?? true)
  }
}

async function getSupabaseContent(): Promise<ContentSnapshot> {
  if (!hasSupabaseEnv()) {
    return createMockSnapshot("Supabase browser env is missing, so the app is showing preview content.")
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return createMockSnapshot("Supabase server client could not be created, so the app is showing preview content.")
  }

  const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }] = await Promise.all([
    supabase.from("courses").select("*").eq("published", true).order("title"),
    supabase.from("lessons").select("*").eq("published", true).order("order_index"),
    supabase.from("challenges").select("*").eq("published", true).order("title")
  ])

  if (!courseRows?.length || !lessonRows?.length) {
    return createMockSnapshot("No published course and lesson rows were found, so the app is showing preview content.")
  }

  const courses = courseRows.map((row) => mapCourse(row as Record<string, unknown>))
  const courseSlugById = new Map(courses.map((course) => [course.id, course.slug]))
  const lessons = lessonRows.map((row) =>
    mapLesson(row as Record<string, unknown>, courseSlugById.get(String((row as Record<string, unknown>).course_id)) ?? "")
  )
  const challenges = (challengeRows ?? []).map((row) => mapChallenge(row as Record<string, unknown>))

  return {
    courses,
    lessons,
    challenges,
    contentSource: "database",
    contentSourceReason: "Loaded published course, lesson, and challenge content from Supabase."
  }
}

export const getContentSnapshot = cache(async () => {
  return getSupabaseContent()
})

export const getCatalog = cache(async (): Promise<CourseWithLessons[]> => {
  const snapshot = await getContentSnapshot()

  return snapshot.courses.map((course) => ({
    course,
    lessons: sortLessons(snapshot.lessons.filter((lesson) => lesson.courseId === course.id)),
    contentSource: snapshot.contentSource,
    contentSourceReason: snapshot.contentSourceReason
  }))
})

export const getCoursePageData = cache(async (courseSlug: string): Promise<CourseWithLessons | null> => {
  const snapshot = await getContentSnapshot()
  const course = snapshot.courses.find((item) => item.slug === courseSlug)

  if (!course) {
    return null
  }

  return {
    course,
    lessons: sortLessons(snapshot.lessons.filter((lesson) => lesson.courseId === course.id)),
    contentSource: snapshot.contentSource,
    contentSourceReason: snapshot.contentSourceReason
  }
})

export const getLessonPageData = cache(async (courseSlug: string, lessonSlug: string): Promise<LessonBundle | null> => {
  const snapshot = await getContentSnapshot()
  const course = snapshot.courses.find((item) => item.slug === courseSlug)
  if (!course) {
    return null
  }

  const lesson = snapshot.lessons.find(
    (item) => item.courseId === course.id && item.slug === lessonSlug && item.published
  )

  if (!lesson) {
    return null
  }

  const challenge = lesson.challengeSlug
    ? snapshot.challenges.find((item) => item.slug === lesson.challengeSlug && item.published) ?? null
    : null

  return {
    course,
    lesson,
    challenge,
    contentSource: snapshot.contentSource,
    contentSourceReason: snapshot.contentSourceReason
  }
})

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return null
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  return user
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser()
  if (!user) {
    return false
  }

  if (!hasSupabaseEnv()) {
    return true
  }

  const supabase = await createServerClient()
  const { data } = await supabase!
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return data?.role === "admin"
}

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
    resumeTarget: resumeRow
      ? ({
          userId: String((resumeRow as Record<string, unknown>).user_id),
          courseSlug: String((resumeRow as Record<string, unknown>).course_slug),
          lessonSlug: String((resumeRow as Record<string, unknown>).lesson_slug),
          updatedAt: String((resumeRow as Record<string, unknown>).updated_at)
        } satisfies ResumeState)
      : null,
    recentLessons
  }
}

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
