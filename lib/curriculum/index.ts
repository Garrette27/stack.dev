import { cache } from "react"

import { getCatalog } from "@/lib/content"
import { getContentSnapshot } from "@/lib/content"
import { getCurrentUser } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { CourseWithLessons } from "@/lib/types"

type CurriculumCourseKind = "course" | "guided_project" | "portfolio_project" | "training"
type CurriculumShelfSlug = "core_library" | "deeper_learning"
type CurriculumTrackSlug = "backend_python_go" | "backend_python_typescript" | "devops_python_go"

type CurriculumCourseMetadata = {
  kind: CurriculumCourseKind
  shelf: CurriculumShelfSlug
  trackSlugs?: CurriculumTrackSlug[]
  sortOrder?: number
}

type CurriculumTrackDefinition = {
  slug: CurriculumTrackSlug
  title: string
  description: string
  courseSlugs: string[]
}

type CurriculumSectionDefinition = {
  slug: string
  shelf: CurriculumShelfSlug
  kind?: CurriculumCourseKind
  title: string
  description: string
}

export type CurriculumCourseCard = CourseWithLessons & {
  kind: CurriculumCourseKind
  kindLabel: string
  totalLessons: number
  totalChallenges: number
  trackSlugs: CurriculumTrackSlug[]
  progress: CurriculumCourseProgress
}

export type CurriculumTrackCard = {
  slug: CurriculumTrackSlug
  title: string
  description: string
  availableCourseCount: number
  configuredCourseCount: number
  totalLessons: number
  totalChallenges: number
  primaryHref: string | null
  primaryCourseTitle: string | null
  progress: CurriculumTrackProgress
}

export type CurriculumSection = {
  slug: string
  title: string
  description: string
  courses: CurriculumCourseCard[]
}

export type CurriculumLandingPageData = {
  trackCards: CurriculumTrackCard[]
  sections: CurriculumSection[]
}

export type CurriculumCourseProgress = {
  status: "not_started" | "in_progress" | "completed"
  completedLessonCount: number
  totalLessonCount: number
  completedChallengeCount: number
  totalChallengeCount: number
  courseHref: string
  resumeHref: string | null
}

export type CurriculumTrackProgress = {
  completedCourseCount: number
  availableCourseCount: number
  completedChallengeCount: number
  totalChallengeCount: number
}

const TRACK_DEFINITIONS: CurriculumTrackDefinition[] = [
  {
    slug: "backend_python_go",
    title: "Back-end Developer Path (Python & Go)",
    description: "Core programming, systems, databases, networking, and applied back-end projects.",
    courseSlugs: [
      "learn-javascript",
      "learn-to-code-in-python",
      "learn-linux",
      "build-a-bookbot",
      "learn-git",
      "learn-object-oriented-programming",
      "build-asteroids",
      "learn-functional-programming",
      "build-an-ai-agent",
      "learn-data-structures-and-algorithms",
      "build-a-static-site-generator",
      "learn-memory-management",
      "personal-project-1",
      "learn-go",
      "learn-http-clients",
      "build-a-pokedex",
      "learn-sql",
      "build-a-blog-aggregator",
      "learn-http-servers",
      "learn-file-servers-and-cdns",
      "learn-docker",
      "learn-pub-sub-architecture",
      "capstone-project",
      "learn-how-to-find-a-programming-job"
    ]
  },
  {
    slug: "backend_python_typescript",
    title: "Back-end Developer Path (Python & TypeScript)",
    description: "A TypeScript-flavored back-end path that keeps the same practical project rhythm.",
    courseSlugs: [
      "learn-javascript",
      "learn-to-code-in-python",
      "learn-linux",
      "learn-git",
      "learn-object-oriented-programming",
      "learn-functional-programming",
      "learn-data-structures-and-algorithms",
      "learn-sql",
      "learn-the-http-protocol",
      "learn-ci-cd",
      "learn-docker"
    ]
  },
  {
    slug: "devops_python_go",
    title: "DevOps Path (Python & Go)",
    description: "Infrastructure-heavy learning for Linux, Docker, Kubernetes, automation, and delivery.",
    courseSlugs: [
      "learn-linux",
      "learn-git",
      "learn-docker",
      "learn-the-http-protocol",
      "learn-kubernetes",
      "learn-ci-cd",
      "learn-cryptography"
    ]
  }
]

const SECTION_DEFINITIONS: CurriculumSectionDefinition[] = [
  {
    slug: "core-courses",
    shelf: "core_library",
    kind: "course",
    title: "Courses",
    description: "Sequential practice paths for concepts, systems, and real programming tools."
  },
  {
    slug: "guided-projects",
    shelf: "core_library",
    kind: "guided_project",
    title: "Guided projects",
    description: "Project-focused reps that turn concepts into working software."
  },
  {
    slug: "portfolio-projects",
    shelf: "core_library",
    kind: "portfolio_project",
    title: "Portfolio projects",
    description: "Milestone projects meant to become serious portfolio pieces."
  },
  {
    slug: "training",
    shelf: "core_library",
    kind: "training",
    title: "Training",
    description: "Focused drills, labs, and future practice modes that are shorter than full courses."
  },
  {
    slug: "deeper-learning",
    shelf: "deeper_learning",
    title: "Deeper learning",
    description: "Advanced follow-up topics for learners who want to keep digging after the main path."
  }
]

const COURSE_METADATA_BY_SLUG: Record<string, CurriculumCourseMetadata> = {
  "learn-javascript": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 10
  },
  "learn-to-code-in-python": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 20
  },
  "learn-linux": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript", "devops_python_go"],
    sortOrder: 30
  },
  "build-a-bookbot": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 40
  },
  "learn-git": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript", "devops_python_go"],
    sortOrder: 50
  },
  "learn-object-oriented-programming": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 60
  },
  "build-asteroids": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 70
  },
  "learn-functional-programming": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 80
  },
  "build-an-ai-agent": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 90
  },
  "learn-data-structures-and-algorithms": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 100
  },
  "build-a-static-site-generator": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 110
  },
  "learn-memory-management": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 120
  },
  "personal-project-1": {
    kind: "portfolio_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 130
  },
  "learn-go": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 140
  },
  "learn-http-clients": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 150
  },
  "build-a-pokedex": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 160
  },
  "learn-sql": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript"],
    sortOrder: 170
  },
  "build-a-blog-aggregator": {
    kind: "guided_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 180
  },
  "learn-http-servers": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 190
  },
  "learn-file-servers-and-cdns": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 200
  },
  "learn-docker": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go", "backend_python_typescript", "devops_python_go"],
    sortOrder: 210
  },
  "learn-pub-sub-architecture": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 220
  },
  "capstone-project": {
    kind: "portfolio_project",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 230
  },
  "learn-how-to-find-a-programming-job": {
    kind: "course",
    shelf: "core_library",
    trackSlugs: ["backend_python_go"],
    sortOrder: 240
  },
  "learn-retrieval-augmented-generation": {
    kind: "course",
    shelf: "deeper_learning",
    sortOrder: 10
  },
  "learn-the-http-protocol": {
    kind: "course",
    shelf: "deeper_learning",
    trackSlugs: ["backend_python_typescript", "devops_python_go"],
    sortOrder: 20
  },
  "learn-git-2": {
    kind: "course",
    shelf: "deeper_learning",
    sortOrder: 30
  },
  "learn-kubernetes": {
    kind: "course",
    shelf: "deeper_learning",
    trackSlugs: ["devops_python_go"],
    sortOrder: 40
  },
  "learn-ci-cd": {
    kind: "course",
    shelf: "deeper_learning",
    trackSlugs: ["backend_python_typescript", "devops_python_go"],
    sortOrder: 50
  },
  "learn-cryptography": {
    kind: "course",
    shelf: "deeper_learning",
    trackSlugs: ["devops_python_go"],
    sortOrder: 60
  },
  "learn-data-structures-and-algorithms-2": {
    kind: "course",
    shelf: "deeper_learning",
    sortOrder: 70
  }
}

function getDefaultCourseMetadata(): CurriculumCourseMetadata {
  return {
    kind: "course",
    shelf: "core_library",
    trackSlugs: [],
    sortOrder: Number.MAX_SAFE_INTEGER
  }
}

function getCourseKindLabel(kind: CurriculumCourseKind) {
  switch (kind) {
    case "guided_project":
      return "Guided project"
    case "portfolio_project":
      return "Portfolio project"
    case "training":
      return "Training"
    default:
      return "Course"
  }
}

function compareCurriculumCourses(left: CurriculumCourseCard, right: CurriculumCourseCard) {
  const leftSortOrder = COURSE_METADATA_BY_SLUG[left.course.slug]?.sortOrder ?? Number.MAX_SAFE_INTEGER
  const rightSortOrder = COURSE_METADATA_BY_SLUG[right.course.slug]?.sortOrder ?? Number.MAX_SAFE_INTEGER

  if (leftSortOrder !== rightSortOrder) {
    return leftSortOrder - rightSortOrder
  }

  return left.course.title.localeCompare(right.course.title)
}

function buildDefaultCourseProgress(entry: CourseWithLessons): CurriculumCourseProgress {
  const totalLessonCount = entry.lessons.length
  const totalChallengeCount = entry.lessons.reduce((total, lesson) => total + lesson.challengeIds.length, 0)

  return {
    status: "not_started",
    completedLessonCount: 0,
    totalLessonCount,
    completedChallengeCount: 0,
    totalChallengeCount,
    courseHref: `/learn/${entry.course.slug}`,
    resumeHref: entry.lessons[0] ? `/learn/${entry.course.slug}/${entry.lessons[0].slug}` : null
  }
}

function buildCurriculumCourseCard(entry: CourseWithLessons): CurriculumCourseCard {
  const metadata = COURSE_METADATA_BY_SLUG[entry.course.slug] ?? getDefaultCourseMetadata()

  return {
    ...entry,
    kind: metadata.kind,
    kindLabel: getCourseKindLabel(metadata.kind),
    totalLessons: entry.lessons.length,
    totalChallenges: entry.lessons.reduce((total, lesson) => total + lesson.challengeIds.length, 0),
    trackSlugs: metadata.trackSlugs ?? [],
    progress: buildDefaultCourseProgress(entry)
  }
}

function buildCurriculumTrackCard(
  definition: CurriculumTrackDefinition,
  coursesBySlug: Map<string, CurriculumCourseCard>
): CurriculumTrackCard | null {
  const availableCourses = definition.courseSlugs
    .map((courseSlug) => coursesBySlug.get(courseSlug) ?? null)
    .filter((course): course is CurriculumCourseCard => Boolean(course))

  if (!availableCourses.length) {
    return null
  }

  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    availableCourseCount: availableCourses.length,
    configuredCourseCount: definition.courseSlugs.length,
    totalLessons: availableCourses.reduce((total, course) => total + course.totalLessons, 0),
    totalChallenges: availableCourses.reduce((total, course) => total + course.totalChallenges, 0),
    primaryHref: availableCourses[0] ? `/learn/${availableCourses[0].course.slug}` : null,
    primaryCourseTitle: availableCourses[0]?.course.title ?? null,
    progress: {
      completedCourseCount: availableCourses.filter((course) => course.progress.status === "completed").length,
      availableCourseCount: availableCourses.length,
      completedChallengeCount: availableCourses.reduce(
        (total, course) => total + course.progress.completedChallengeCount,
        0
      ),
      totalChallengeCount: availableCourses.reduce((total, course) => total + course.progress.totalChallengeCount, 0)
    }
  }
}

function buildCurriculumSection(
  definition: CurriculumSectionDefinition,
  courses: CurriculumCourseCard[]
): CurriculumSection | null {
  const matchingCourses = courses
    .filter((course) => {
      const metadata = COURSE_METADATA_BY_SLUG[course.course.slug] ?? getDefaultCourseMetadata()

      if (metadata.shelf !== definition.shelf) {
        return false
      }

      if (!definition.kind) {
        return true
      }

      return metadata.kind === definition.kind
    })
    .sort(compareCurriculumCourses)

  if (!matchingCourses.length) {
    return null
  }

  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    courses: matchingCourses
  }
}

async function loadCourseProgressBySlug(courseCards: CurriculumCourseCard[]) {
  const user = await getCurrentUser()

  if (!user || !hasSupabaseEnv()) {
    return new Map<string, CurriculumCourseProgress>()
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return new Map<string, CurriculumCourseProgress>()
  }

  const snapshot = await getContentSnapshot()
  const challengeById = new Map(snapshot.challenges.map((challenge) => [challenge.id, challenge]))
  const lessonIds = courseCards.flatMap((course) => course.lessons.map((lesson) => lesson.id))
  const challengeIds = courseCards.flatMap((course) => course.lessons.flatMap((lesson) => lesson.challengeIds))
  const challengeVersionIds = challengeIds
    .map((challengeId) => challengeById.get(challengeId)?.versionId ?? null)
    .filter((versionId): versionId is string => Boolean(versionId))

  const [lessonProgressRows, resumeRow, versionSubmissionRows, legacySubmissionRows] = await Promise.all([
    lessonIds.length
      ? supabase.from("lesson_progress").select("lesson_id,status").eq("user_id", user.id).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.from("resume_state").select("course_slug,lesson_slug").eq("user_id", user.id).maybeSingle(),
    challengeVersionIds.length
      ? supabase
          .from("submissions")
          .select("challenge_id,challenge_version_id")
          .eq("user_id", user.id)
          .eq("passed", true)
          .in("challenge_version_id", challengeVersionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    challengeIds.length
      ? supabase
          .from("submissions")
          .select("challenge_id")
          .eq("user_id", user.id)
          .eq("passed", true)
          .is("challenge_version_id", null)
          .in("challenge_id", challengeIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] })
  ])

  const completedLessonIds = new Set(
    (lessonProgressRows.data ?? [])
      .filter((row) => String(row.status ?? "") === "completed")
      .map((row) => String(row.lesson_id))
  )
  const inProgressLessonIds = new Set(
    (lessonProgressRows.data ?? [])
      .filter((row) => String(row.status ?? "") === "in_progress")
      .map((row) => String(row.lesson_id))
  )
  const completedChallengeIds = new Set(
    [...(versionSubmissionRows.data ?? []), ...(legacySubmissionRows.data ?? [])]
      .map((row) => String(row.challenge_id ?? ""))
      .filter(Boolean)
  )
  const resumeCourseSlug = resumeRow.data?.course_slug ? String(resumeRow.data.course_slug) : null
  const resumeLessonSlug = resumeRow.data?.lesson_slug ? String(resumeRow.data.lesson_slug) : null

  return new Map(
    courseCards.map((course) => {
      const completedLessonCount = course.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
      const completedChallengeCount = course.lessons.reduce(
        (total, lesson) =>
          total + lesson.challengeIds.filter((challengeId) => completedChallengeIds.has(challengeId)).length,
        0
      )
      const totalLessonCount = course.totalLessons
      const totalChallengeCount = course.totalChallenges
      const courseHasProgress =
        completedChallengeCount > 0 || course.lessons.some((lesson) => inProgressLessonIds.has(lesson.id))
      const status =
        totalChallengeCount > 0 && completedChallengeCount >= totalChallengeCount
          ? "completed"
          : courseHasProgress
            ? "in_progress"
            : "not_started"
      const continueLesson =
        resumeCourseSlug === course.course.slug && resumeLessonSlug
          ? course.lessons.find((lesson) => lesson.slug === resumeLessonSlug) ?? null
          : null
      const fallbackLesson =
        continueLesson ??
        course.lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ??
        course.lessons[0] ??
        null

      return [
        course.course.slug,
        {
          status,
          completedLessonCount,
          totalLessonCount,
          completedChallengeCount,
          totalChallengeCount,
          courseHref: `/learn/${course.course.slug}`,
          resumeHref: fallbackLesson ? `/learn/${course.course.slug}/${fallbackLesson.slug}` : null
        } satisfies CurriculumCourseProgress
      ]
    })
  )
}

/**
 * Builds the learner-facing curriculum landing page so pages can render
 * paths, shelves, and project groupings without duplicating catalog rules.
 */
export const getCurriculumLandingPageData = cache(async (): Promise<CurriculumLandingPageData> => {
  const catalog = await getCatalog()
  const courseCards = catalog.map(buildCurriculumCourseCard)
  const progressByCourseSlug = await loadCourseProgressBySlug(courseCards)
  const hydratedCourseCards = courseCards.map((course) => ({
    ...course,
    progress: progressByCourseSlug.get(course.course.slug) ?? course.progress
  }))
  const coursesBySlug = new Map(hydratedCourseCards.map((course) => [course.course.slug, course]))

  return {
    trackCards: TRACK_DEFINITIONS
      .map((definition) => buildCurriculumTrackCard(definition, coursesBySlug))
      .filter((track): track is CurriculumTrackCard => Boolean(track)),
    sections: SECTION_DEFINITIONS
      .map((definition) => buildCurriculumSection(definition, hydratedCourseCards))
      .filter((section): section is CurriculumSection => Boolean(section))
  }
})
