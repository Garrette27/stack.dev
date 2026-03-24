import type { ContentSnapshot } from "@/lib/types"

import { createMockSnapshot, mapChallenge, mapCourse, mapLesson } from "./shared"

type SnapshotRows = {
  courseRows?: Record<string, unknown>[] | null
  lessonRows?: Record<string, unknown>[] | null
  challengeRows?: Record<string, unknown>[] | null
}

type SnapshotLoadResult = {
  rows: SnapshotRows
  fallbackReason?: string
}

type SnapshotLoaderOptions = {
  loadRows: () => Promise<SnapshotLoadResult>
  contentSourceReason: string
  emptyContentReason: string
  emptyMode: "mock" | "database"
}

function buildDatabaseSnapshot(rows: SnapshotRows, contentSourceReason: string): ContentSnapshot {
  const courses = (rows.courseRows ?? []).map((row) => mapCourse(row))
  const courseSlugById = new Map(courses.map((course) => [course.id, course.slug]))
  const lessons = (rows.lessonRows ?? []).map((row) => mapLesson(row, courseSlugById.get(String(row.course_id)) ?? ""))
  const challenges = (rows.challengeRows ?? []).map((row) => mapChallenge(row))

  return {
    courses,
    lessons,
    challenges,
    contentSource: "database",
    contentSourceReason
  }
}

/**
 * Loads a content snapshot from database rows and keeps row-mapping decisions
 * hidden behind a single loader shared by public and admin readers.
 */
export async function loadSnapshotFromRows(options: SnapshotLoaderOptions): Promise<ContentSnapshot> {
  const { rows, fallbackReason } = await options.loadRows()

  if (fallbackReason) {
    return createMockSnapshot(fallbackReason)
  }

  const snapshot = buildDatabaseSnapshot(rows, options.contentSourceReason)
  const hasLessonStructure = snapshot.courses.length > 0 && snapshot.lessons.length > 0
  const hasAnyRows = snapshot.courses.length > 0 || snapshot.lessons.length > 0 || snapshot.challenges.length > 0

  if (options.emptyMode === "mock" && !hasLessonStructure) {
    return createMockSnapshot(options.emptyContentReason)
  }

  if (options.emptyMode === "database" && !hasAnyRows) {
    return {
      ...snapshot,
      contentSourceReason: options.emptyContentReason
    }
  }

  return snapshot
}
