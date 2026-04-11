export type CodeChallengeLanguage = "python" | "javascript" | "typescript" | "go" | "sqlite"

export type ChallengeKind = "code" | "multiple_choice" | "local_lab"
export type PublicationState = "draft" | "published" | "archived"
export type ChallengePublicationState = PublicationState

export type MultipleChoiceOption = {
  key: string
  label: string
}

export type Course = {
  id: string
  slug: string
  versionId: string | null
  versionNumber: number | null
  publishedVersionId: string | null
  draftVersionId: string | null
  publicationState: PublicationState
  title: string
  summary: string
  difficulty: string
  accent: string
  published: boolean
  updatedAt: string | null
}

export type Lesson = {
  id: string
  courseId: string
  courseSlug: string
  slug: string
  versionId: string | null
  versionNumber: number | null
  publishedVersionId: string | null
  draftVersionId: string | null
  publicationState: PublicationState
  title: string
  summary: string
  estimatedMinutes: number
  bodyMdx: string
  challengeIds: string[]
  orderIndex: number
  published: boolean
  updatedAt: string | null
}

export type ChallengeBase = {
  id: string
  slug: string
  title: string
  versionId: string | null
  versionNumber: number | null
  publishedVersionId: string | null
  draftVersionId: string | null
  publicationState: ChallengePublicationState
  readingMdx: string
  promptMdx: string
  published: boolean
  updatedAt: string | null
}

export type CodeChallenge = ChallengeBase & {
  kind: "code"
  language: CodeChallengeLanguage
  judge0LanguageId: number
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: []
  correctChoiceKey: null
  choiceExplanationMdx: ""
}

export type MultipleChoiceChallenge = ChallengeBase & {
  kind: "multiple_choice"
  language: null
  judge0LanguageId: null
  starterCode: ""
  solutionCode: ""
  hiddenTestCode: ""
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string
  choiceExplanationMdx: string
}

export type LocalLabChallenge = ChallengeBase & {
  kind: "local_lab"
  language: null
  judge0LanguageId: null
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: []
  correctChoiceKey: null
  choiceExplanationMdx: ""
}

export type Challenge = CodeChallenge | MultipleChoiceChallenge | LocalLabChallenge

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
