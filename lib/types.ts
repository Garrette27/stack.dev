export type Course = {
  id: string
  slug: string
  title: string
  summary: string
  difficulty: string
  accent: string
  published: boolean
}

export type Lesson = {
  id: string
  courseId: string
  courseSlug: string
  slug: string
  title: string
  summary: string
  estimatedMinutes: number
  bodyMdx: string
  challengeSlug: string | null
  orderIndex: number
  published: boolean
}

export type Challenge = {
  id: string
  slug: string
  title: string
  language: "python" | "javascript"
  judge0LanguageId: number
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  published: boolean
}

export type ProgressStatus = "not_started" | "in_progress" | "completed"

export type LessonProgress = {
  lessonId: string
  userId: string
  status: ProgressStatus
  lastSubmissionId: string | null
  completedAt: string | null
  updatedAt: string
}

export type ResumeState = {
  userId: string
  courseSlug: string
  lessonSlug: string
  updatedAt: string
}

export type CourseWithLessons = {
  course: Course
  lessons: Lesson[]
  contentSource: "database" | "mock"
  contentSourceReason: string
}

export type LessonBundle = {
  course: Course
  lesson: Lesson
  challenge: Challenge | null
  contentSource: "database" | "mock"
  contentSourceReason: string
}

export type DashboardState = {
  courseCount: number
  lessonCount: number
  completedLessons: number
  inProgressLessons: number
  resumeTarget: ResumeState | null
  recentLessons: Array<Lesson & { courseTitle: string; status: ProgressStatus }>
}

export type SubmissionOutcome = {
  configured: boolean
  passed: boolean
  stdout: string
  stderr: string
  compileOutput: string
  status: string
  feedback: string
}

export type ContentSnapshot = {
  courses: Course[]
  lessons: Lesson[]
  challenges: Challenge[]
  contentSource: "database" | "mock"
  contentSourceReason: string
}
