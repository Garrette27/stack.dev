import { mockContent } from "@/lib/mock-data"
import { getDefaultJudge0LanguageId, isSupportedChallengeLanguage } from "@/lib/judge0/languages"
import type { Challenge, ContentSnapshot, Course, Lesson } from "@/lib/types"

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
  const languageValue = String(row.language ?? "python")
  const language = isSupportedChallengeLanguage(languageValue) ? languageValue : "python"

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    language,
    judge0LanguageId: Number(row.judge0_language_id ?? getDefaultJudge0LanguageId(language)),
    readingMdx: String(row.reading_mdx ?? ""),
    promptMdx: String(row.prompt_mdx ?? ""),
    starterCode: String(row.starter_code ?? ""),
    solutionCode: String(row.solution_code ?? ""),
    hiddenTestCode: String(row.hidden_test_code ?? ""),
    published: Boolean(row.published ?? true)
  }
}
