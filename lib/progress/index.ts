import { hasSupabaseEnv } from "@/lib/env"
import { mockResumeState } from "@/lib/mock-data"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { DashboardState, LessonProgress, ResumeState } from "@/lib/types"

import { getCurrentUser } from "@/lib/auth"
import { getContentSnapshot } from "@/lib/content"
import { sortLessons } from "@/lib/content/shared"

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
