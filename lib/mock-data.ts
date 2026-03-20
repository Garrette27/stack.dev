import type { Challenge, ContentSnapshot, Course, Lesson, ResumeState } from "@/lib/types"

const course: Course = {
  id: "course-backend-foundations",
  slug: "backend-foundations",
  title: "Backend Foundations",
  summary:
    "A text-first path for backend thinking: data flow, functions, and practical code checks.",
  difficulty: "Beginner",
  accent: "#c96f36",
  published: true
}

const challenge: Challenge = {
  id: "challenge-python-greet",
  slug: "python-greet-user",
  title: "Write a greeting function",
  language: "python",
  judge0LanguageId: 71,
  promptMdx: `Create a function named \`greet\` that returns \`Hello, {name}!\`.

- The function must accept a single string argument.
- Return the greeting instead of printing it.
- Keep the function body short and readable.`,
  starterCode: `def greet(name):
    # return the greeting string
    raise NotImplementedError("write your solution here")
`,
  solutionCode: `def greet(name):
    return f"Hello, {name}!"
`,
  hiddenTestCode: `assert greet("Ada") == "Hello, Ada!"
assert greet("Rico") == "Hello, Rico!"
`,
  published: true
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
  bodyMdx: `# Build small loops that compound

Boot.dev works because it keeps the loop tight: read a little, code a little, check a little, move on.

## What matters in your product

1. The lesson should be short enough to finish in one sitting.
2. The challenge should verify one idea clearly.
3. The progress system should make it obvious where to continue next.

## What you are practicing here

You will write a tiny function and submit it to the checker. That sounds small, but that exact loop is the core of your future app.`,
  challengeSlug: challenge.slug,
  orderIndex: 1,
  published: true
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
