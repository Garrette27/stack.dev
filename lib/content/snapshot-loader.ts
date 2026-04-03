import type { ContentSnapshot } from "@/lib/types"

import { mapChallengesFromRows, type ChallengeVersionLoadMode } from "./challenge-versions"
import { createMockSnapshot, mapChallenge, mapCourse, mapLesson } from "./shared"

type SnapshotRows = {
  courseRows?: Record<string, unknown>[] | null
  lessonRows?: Record<string, unknown>[] | null
  challengeRows?: Record<string, unknown>[] | null
  challengeVersionRows?: Record<string, unknown>[] | null
  lessonChallengeRows?: Record<string, unknown>[] | null
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
  challengeVersionMode?: ChallengeVersionLoadMode
}

type OptionalRowsResult = {
  data: Record<string, unknown>[] | null
  error: { code?: string; message?: string } | null
}

function buildLessonChallengeIdsByLessonId(rows: SnapshotRows, challengeIdBySlug: Map<string, string>) {
  const challengeIdsByLessonId = new Map<string, string[]>()

  if (rows.lessonChallengeRows?.length) {
    rows.lessonChallengeRows.forEach((row) => {
      const lessonId = String(row.lesson_id)
      const challengeId = String(row.challenge_id)
      const challengeIds = challengeIdsByLessonId.get(lessonId) ?? []
      challengeIds.push(challengeId)
      challengeIdsByLessonId.set(lessonId, challengeIds)
    })

    return challengeIdsByLessonId
  }

  ;(rows.lessonRows ?? []).forEach((row) => {
    const lessonId = String(row.id)
    const challengeSlug = row.challenge_slug ? String(row.challenge_slug) : null
    const challengeId = challengeSlug ? challengeIdBySlug.get(challengeSlug) : null

    challengeIdsByLessonId.set(lessonId, challengeId ? [challengeId] : [])
  })

  return challengeIdsByLessonId
}

function buildDatabaseSnapshot(
  rows: SnapshotRows,
  contentSourceReason: string,
  challengeVersionMode: ChallengeVersionLoadMode
): ContentSnapshot {
  const challenges = rows.challengeVersionRows
    ? mapChallengesFromRows(rows.challengeRows ?? [], rows.challengeVersionRows, challengeVersionMode)
    : (rows.challengeRows ?? []).map((row) => mapChallenge(row))
  const challengeIdBySlug = new Map(challenges.map((challenge) => [challenge.slug, challenge.id]))
  const lessonChallengeIdsByLessonId = buildLessonChallengeIdsByLessonId(rows, challengeIdBySlug)
  const courses = (rows.courseRows ?? []).map((row) => mapCourse(row))
  const courseSlugById = new Map(courses.map((course) => [course.id, course.slug]))
  const lessons = (rows.lessonRows ?? []).map((row) =>
    mapLesson(
      row,
      courseSlugById.get(String(row.course_id)) ?? "",
      lessonChallengeIdsByLessonId.get(String(row.id)) ?? []
    )
  )

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

  const snapshot = buildDatabaseSnapshot(rows, options.contentSourceReason, options.challengeVersionMode ?? "published")
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

/**
 * Reads challenge version rows when versioning has been migrated and silently
 * falls back to direct challenge content while older databases catch up.
 */
export async function loadOptionalChallengeVersionRows(
  loadRows: () => Promise<OptionalRowsResult>
): Promise<Record<string, unknown>[] | null> {
  const { data, error } = await loadRows()

  if (!error) {
    return data ?? []
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return null
  }

  throw new Error(error.message ?? "Unable to load challenge version rows.")
}

/**
 * Reads lesson-to-challenge rows when the relation table exists and silently
 * falls back while older databases are still on the legacy one-challenge model.
 */
export async function loadOptionalLessonChallengeRows(
  loadRows: () => Promise<OptionalRowsResult>
): Promise<Record<string, unknown>[] | null> {
  const { data, error } = await loadRows()

  if (!error) {
    return data ?? []
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return null
  }

  throw new Error(error.message ?? "Unable to load lesson challenge rows.")
}
