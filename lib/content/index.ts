import { cache } from "react"

import { hasSupabaseEnv } from "@/lib/env"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { CourseWithLessons, LessonBundle } from "@/lib/types"

import { loadSnapshotFromRows } from "./snapshot-loader"
import { sortLessons } from "./shared"

async function getSupabaseContent() {
  return loadSnapshotFromRows({
    emptyMode: "mock",
    emptyContentReason: "No published course and lesson rows were found, so the app is showing preview content.",
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

      const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }] = await Promise.all([
        supabase.from("courses").select("*").eq("published", true).order("title"),
        supabase.from("lessons").select("*").eq("published", true).order("order_index"),
        supabase.from("challenges").select("*").eq("published", true).order("title")
      ])

      return {
        rows: {
          courseRows: (courseRows ?? []) as Record<string, unknown>[],
          lessonRows: (lessonRows ?? []) as Record<string, unknown>[],
          challengeRows: (challengeRows ?? []) as Record<string, unknown>[]
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
