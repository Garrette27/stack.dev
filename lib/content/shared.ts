import {
  buildChallengeRecord,
  normalizeChallengeKind,
  normalizeChallengePublicationState
} from "@/lib/challenges/model"
import { mockContent } from "@/lib/mock-data"
import type { Challenge, ChallengeKind, ContentSnapshot, Course, Lesson } from "@/lib/types"

export function createMockSnapshot(reason: string): ContentSnapshot {
  return {
    ...mockContent,
    contentSource: "mock",
    contentSourceReason: reason
  }
}

export function sortLessons(lessons: Lesson[]) {
  return [...lessons].sort((a, b) => a.orderIndex - b.orderIndex)
}

export function getCourseLessons(snapshot: Pick<ContentSnapshot, "lessons">, courseId: string | null) {
  if (!courseId) {
    return []
  }

  return sortLessons(snapshot.lessons.filter((lesson) => lesson.courseId === courseId))
}

/**
 * Resolves one lesson's assignments from the shared challenge collection so
 * learner, practice, and admin surfaces can agree on visibility rules.
 */
export function getLessonChallenges(
  lesson: Lesson,
  challenges: Challenge[],
  options?: {
    includeHidden?: boolean
  }
) {
  const includeHidden = options?.includeHidden ?? false

  return lesson.challengeIds
    .map((challengeId) => challenges.find((challenge) => challenge.id === challengeId) ?? null)
    .filter((challenge): challenge is Challenge => {
      if (!challenge) {
        return false
      }

      return includeHidden ? true : challenge.published
    })
}

export function getVisibleChallengeCountForLesson(lesson: Lesson, challenges: Challenge[]) {
  return getLessonChallenges(lesson, challenges).length
}

export function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    slug: String(row.slug),
    versionId: row.id ? String(row.id) : null,
    versionNumber: null,
    publishedVersionId: row.current_published_version_id ? String(row.current_published_version_id) : null,
    draftVersionId: row.current_draft_version_id ? String(row.current_draft_version_id) : null,
    publicationState: normalizeChallengePublicationState(row.status, Boolean(row.published ?? true)),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    difficulty: String(row.difficulty ?? "Beginner"),
    accent: String(row.accent ?? "#c96f36"),
    published: Boolean(row.published ?? true),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  }
}

export function mapLesson(row: Record<string, unknown>, courseSlug: string, challengeIds: string[]): Lesson {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    courseSlug,
    slug: String(row.slug),
    versionId: row.id ? String(row.id) : null,
    versionNumber: null,
    publishedVersionId: row.current_published_version_id ? String(row.current_published_version_id) : null,
    draftVersionId: row.current_draft_version_id ? String(row.current_draft_version_id) : null,
    publicationState: normalizeChallengePublicationState(row.status, Boolean(row.published ?? true)),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    estimatedMinutes: Number(row.estimated_minutes ?? 10),
    bodyMdx: String(row.body_mdx ?? ""),
    challengeIds,
    orderIndex: Number(row.order_index ?? 1),
    published: Boolean(row.published ?? true),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  }
}

export function mapChallenge(row: Record<string, unknown>): Challenge {
  const kind = normalizeChallengeKind(row.kind)

  return buildChallengeRecord({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    versionId: row.id ? String(row.id) : null,
    versionNumber: typeof row.version_number === "number" ? row.version_number : row.version_number ? Number(row.version_number) : null,
    publishedVersionId: row.current_published_version_id ? String(row.current_published_version_id) : null,
    draftVersionId: row.current_draft_version_id ? String(row.current_draft_version_id) : null,
    publicationState: normalizeChallengePublicationState(row.status, Boolean(row.published ?? true)),
    kind,
    language: row.language == null ? null : String(row.language),
    judge0LanguageId: typeof row.judge0_language_id === "number" ? row.judge0_language_id : null,
    readingMdx: String(row.reading_mdx ?? ""),
    promptMdx: String(row.prompt_mdx ?? ""),
    starterCode: String(row.starter_code ?? ""),
    solutionCode: String(row.solution_code ?? ""),
    hiddenTestCode: String(row.hidden_test_code ?? ""),
    choiceOptions: row.choice_options,
    correctChoiceKey: row.choice_correct_key ? String(row.choice_correct_key) : null,
    choiceExplanationMdx: String(row.choice_explanation_mdx ?? ""),
    published: Boolean(row.published ?? true),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  })
}
