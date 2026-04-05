export type CodeChallengeLanguage = "python" | "javascript" | "typescript" | "go" | "sqlite"

export type ChallengeKind = "code" | "multiple_choice" | "local_lab"
export type ChallengePublicationState = "draft" | "published" | "archived"

export type MultipleChoiceOption = {
  key: string
  label: string
}

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
  challengeIds: string[]
  orderIndex: number
  published: boolean
}

export type Challenge = {
  id: string
  slug: string
  title: string
  versionId: string | null
  versionNumber: number | null
  publishedVersionId: string | null
  draftVersionId: string | null
  publicationState: ChallengePublicationState
  kind: ChallengeKind
  language: CodeChallengeLanguage | null
  judge0LanguageId: number | null
  readingMdx: string
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string | null
  choiceExplanationMdx: string
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

export type CourseReadingEntry = {
  id: string
  href: string
  title: string
  sectionLabel: string
  bodyMdx: string
}

export type LessonBundle = {
  course: Course
  lesson: Lesson
  challenges: Challenge[]
  courseIndex: number
  currentLessonIndex: number
  courseLessons: Lesson[]
  courseReadingEntries: CourseReadingEntry[]
  courseOptions: Array<{ slug: string; title: string; index: number }>
  previousLessonSlug: string | null
  nextLessonSlug: string | null
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
