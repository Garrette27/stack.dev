import { mockContent } from "@/lib/mock-data"
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

export function mapLesson(row: Record<string, unknown>, courseSlug: string): Lesson {
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

export function mapChallenge(row: Record<string, unknown>): Challenge {
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
