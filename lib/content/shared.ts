import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { mockContent } from "@/lib/mock-data"
import { getDefaultJudge0LanguageId, isSupportedChallengeLanguage } from "@/lib/judge0/languages"
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

export function mapCourse(row: Record<string, unknown>): Course {
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

export function mapLesson(row: Record<string, unknown>, courseSlug: string, challengeIds: string[]): Lesson {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    courseSlug,
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary ?? ""),
    estimatedMinutes: Number(row.estimated_minutes ?? 10),
    bodyMdx: String(row.body_mdx ?? ""),
    challengeIds,
    orderIndex: Number(row.order_index ?? 1),
    published: Boolean(row.published ?? true)
  }
}

export function mapChallenge(row: Record<string, unknown>): Challenge {
  const kindValue = String(row.kind ?? "code")
  const kind: ChallengeKind =
    kindValue === "multiple_choice" ? "multiple_choice" : kindValue === "local_lab" ? "local_lab" : "code"
  const languageValue = row.language == null ? null : String(row.language)
  const language =
    languageValue && isSupportedChallengeLanguage(languageValue) ? languageValue : kind === "code" ? "python" : null
  const judge0LanguageId =
    kind === "code" && typeof row.judge0_language_id === "number"
      ? row.judge0_language_id
      : kind === "code" && language
        ? getDefaultJudge0LanguageId(language)
        : null

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    versionId: row.id ? String(row.id) : null,
    versionNumber: typeof row.version_number === "number" ? row.version_number : row.version_number ? Number(row.version_number) : null,
    publishedVersionId: row.current_published_version_id ? String(row.current_published_version_id) : null,
    draftVersionId: row.current_draft_version_id ? String(row.current_draft_version_id) : null,
    publicationState:
      String(row.status ?? (row.published ?? true ? "published" : "draft")) === "draft"
        ? "draft"
        : String(row.status ?? "") === "archived"
          ? "archived"
          : "published",
    kind,
    language,
    judge0LanguageId,
    readingMdx: String(row.reading_mdx ?? ""),
    promptMdx: String(row.prompt_mdx ?? ""),
    starterCode: String(row.starter_code ?? ""),
    solutionCode: String(row.solution_code ?? ""),
    hiddenTestCode: String(row.hidden_test_code ?? ""),
    choiceOptions: normalizeMultipleChoiceOptions(row.choice_options),
    correctChoiceKey: row.choice_correct_key ? String(row.choice_correct_key) : null,
    choiceExplanationMdx: String(row.choice_explanation_mdx ?? ""),
    published: Boolean(row.published ?? true)
  }
}
