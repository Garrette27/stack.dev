import { cache } from "react"

import { hasSupabaseEnv } from "@/lib/env"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { CourseReadingEntry, CourseWithLessons, LessonBundle } from "@/lib/types"

import { loadOptionalChallengeVersionRows, loadOptionalLessonChallengeRows, loadSnapshotFromRows } from "./snapshot-loader"
import { sortLessons } from "./shared"

async function getSupabaseContent() {
  return loadSnapshotFromRows({
    emptyMode: "database",
    emptyContentReason: "No live course catalog content has been published yet.",
    contentSourceReason: "Loaded published course, lesson, and challenge content from Supabase.",
    loadRows: async () => {
      if (!hasSupabaseEnv()) {
        return {
          rows: {},
          fallbackReason: "Supabase browser env is missing, so the app is showing preview content."
        }
      }

      const supabase = await createServerClient()
      if (!supabase) {
        return {
          rows: {},
          fallbackReason: "Supabase server client could not be created, so the app is showing preview content."
        }
      }

      const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }, challengeVersionRows, lessonChallengeRows] = await Promise.all([
        supabase.from("courses").select("*").eq("published", true).order("title"),
        supabase.from("lessons").select("*").eq("published", true).order("order_index"),
        supabase.from("challenges").select("*").eq("published", true).order("title"),
        loadOptionalChallengeVersionRows(async () => {
          const result = await supabase
            .from("challenge_versions")
            .select("*")
            .order("challenge_id")
            .order("version_number", { ascending: false })

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        }),
        loadOptionalLessonChallengeRows(async () => {
          const result = await supabase
            .from("lesson_challenges")
            .select("lesson_id,challenge_id,order_index")
            .order("lesson_id")
            .order("order_index")

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        })
      ])

      return {
        rows: {
          courseRows: (courseRows ?? []) as Record<string, unknown>[],
          lessonRows: (lessonRows ?? []) as Record<string, unknown>[],
          challengeRows: (challengeRows ?? []) as Record<string, unknown>[],
          challengeVersionRows,
          lessonChallengeRows
        }
      }
    }
  })
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

/**
 * Builds a course-wide reading index so learner-side search can look beyond the
 * current chapter and include assignment-specific explanations when present.
 */
function buildCourseReadingEntries(
  courseSlug: string,
  courseLessons: LessonBundle["courseLessons"],
  snapshotChallenges: Awaited<ReturnType<typeof getContentSnapshot>>["challenges"]
): CourseReadingEntry[] {
  const entries: CourseReadingEntry[] = []

  courseLessons.forEach((lesson, lessonIndex) => {
    if (lesson.bodyMdx.trim()) {
      entries.push({
        id: `lesson:${lesson.slug}`,
        href: `/learn/${courseSlug}/${lesson.slug}`,
        title: lesson.title,
        sectionLabel: `CH${lessonIndex + 1} reading`,
        bodyMdx: lesson.bodyMdx
      })
    }

    const lessonChallenges = lesson.challengeIds
      .map((challengeId) => snapshotChallenges.find((challenge) => challenge.id === challengeId && challenge.published) ?? null)
      .filter((challenge): challenge is NonNullable<typeof challenge> => Boolean(challenge))

    lessonChallenges.forEach((challenge, challengeIndex) => {
      const assignmentReading = challenge.readingMdx.trim() || challenge.promptMdx.trim()

      if (!assignmentReading) {
        return
      }

      entries.push({
        id: `challenge:${challenge.slug}`,
        href: `/learn/${courseSlug}/${lesson.slug}?assignment=${challenge.slug}`,
        title: challenge.title,
        sectionLabel: `CH${lessonIndex + 1} - A${challengeIndex + 1} reading`,
        bodyMdx: assignmentReading
      })
    })
  })

  return entries
}

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

  const courseLessons = sortLessons(snapshot.lessons.filter((item) => item.courseId === course.id && item.published))
  const currentLessonIndex = courseLessons.findIndex((item) => item.id === lesson.id)
  const safeCurrentLessonIndex = currentLessonIndex >= 0 ? currentLessonIndex : 0
  const challenges = lesson.challengeIds
    .map((challengeId) => snapshot.challenges.find((item) => item.id === challengeId && item.published) ?? null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const courseReadingEntries = buildCourseReadingEntries(courseSlug, courseLessons, snapshot.challenges)

  return {
    course,
    lesson,
    challenges,
    courseIndex: snapshot.courses.findIndex((item) => item.id === course.id) + 1,
    currentLessonIndex: safeCurrentLessonIndex,
    courseLessons,
    courseReadingEntries,
    courseOptions: snapshot.courses.map((item, index) => ({
      slug: item.slug,
      title: item.title,
      index: index + 1
    })),
    previousLessonSlug: courseLessons[safeCurrentLessonIndex - 1]?.slug ?? null,
    nextLessonSlug: courseLessons[safeCurrentLessonIndex + 1]?.slug ?? null,
    contentSource: snapshot.contentSource,
    contentSourceReason: snapshot.contentSourceReason
  }
})
