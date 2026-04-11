import type { Challenge, ContentSnapshot, Course, Lesson, ResumeState } from "@/lib/types"

const course: Course = {
  id: "course-backend-foundations",
  slug: "backend-foundations",
  title: "Backend Foundations",
  summary:
    "A text-first path for backend thinking: data flow, functions, and practical code checks.",
  difficulty: "Beginner",
  accent: "#c96f36",
  versionId: "course-backend-foundations-v1",
  versionNumber: 1,
  publishedVersionId: "course-backend-foundations-v1",
  draftVersionId: null,
  publicationState: "published",
  published: true,
  updatedAt: new Date("2026-03-09T08:00:00.000Z").toISOString()
}

const challenge: Challenge = {
  id: "challenge-javascript-greet",
  slug: "javascript-greet-user",
  title: "Write a greeting function",
  versionId: "challenge-javascript-greet-v1",
  versionNumber: 1,
  publishedVersionId: "challenge-javascript-greet-v1",
  draftVersionId: null,
  publicationState: "published",
  kind: "code",
  language: "javascript",
  judge0LanguageId: 102,
  readingMdx: "",
  promptMdx: `Create a function named \`greet\` that returns \`Hello, {name}!\`.

- The function must accept a single string argument.
- Return the greeting instead of printing it.
- Keep the function body short and readable.`,
  starterCode: `function greet(name) {
  throw new Error("write your solution here")
}
`,
  solutionCode: `function greet(name) {
  return \`Hello, \${name}!\`
}
`,
  hiddenTestCode: `if (greet("Ada") !== "Hello, Ada!") {
  throw new Error("Ada greeting is incorrect")
}
if (greet("Rico") !== "Hello, Rico!") {
  throw new Error("Rico greeting is incorrect")
}
`,
  choiceOptions: [],
  correctChoiceKey: null,
  choiceExplanationMdx: "",
  published: true,
  updatedAt: new Date("2026-03-09T08:00:00.000Z").toISOString()
}

const lesson: Lesson = {
  id: "lesson-python-greet",
  courseId: course.id,
  courseSlug: course.slug,
  slug: "functions-and-feedback",
  title: "Functions and feedback loops",
  summary:
    "Learn why tiny functions, fast checks, and visible progress are enough to build momentum every day.",
  estimatedMinutes: 12,
  versionId: "lesson-python-greet-v1",
  versionNumber: 1,
  publishedVersionId: "lesson-python-greet-v1",
  draftVersionId: null,
  publicationState: "published",
  bodyMdx: `# Build small loops that compound

Short practice sessions are easier to repeat than long study blocks.

## What you are practicing

1. Read a small prompt carefully.
2. Write a focused solution.
3. Use feedback to improve the next attempt.

## Why this matters

Consistent repetition matters more than one perfect study day. This lesson keeps the task small so you can finish it and move to the next step.`,
  challengeIds: [challenge.id],
  orderIndex: 1,
  published: true,
  updatedAt: new Date("2026-03-09T08:00:00.000Z").toISOString()
}

export const mockContent: ContentSnapshot = {
  courses: [course],
  lessons: [lesson],
  challenges: [challenge],
  contentSource: "mock",
  contentSourceReason: "Using the built-in preview lesson because live published content is not available."
}

export const mockResumeState: ResumeState = {
  userId: "local-preview-user",
  courseSlug: course.slug,
  lessonSlug: lesson.slug,
  updatedAt: new Date("2026-03-09T08:00:00.000Z").toISOString()
}
