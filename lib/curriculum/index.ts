import { cache } from "react"

import { getCatalog } from "@/lib/content"
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

function buildCurriculumCourseCard(entry: CourseWithLessons): CurriculumCourseCard {
  const metadata = COURSE_METADATA_BY_SLUG[entry.course.slug] ?? getDefaultCourseMetadata()

  return {
    ...entry,
    kind: metadata.kind,
    kindLabel: getCourseKindLabel(metadata.kind),
    totalLessons: entry.lessons.length,
    totalChallenges: entry.lessons.reduce((total, lesson) => total + lesson.challengeIds.length, 0),
    trackSlugs: metadata.trackSlugs ?? []
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
    primaryCourseTitle: availableCourses[0]?.course.title ?? null
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

/**
 * Builds the learner-facing curriculum landing page so pages can render
 * paths, shelves, and project groupings without duplicating catalog rules.
 */
export const getCurriculumLandingPageData = cache(async (): Promise<CurriculumLandingPageData> => {
  const catalog = await getCatalog()
  const courseCards = catalog.map(buildCurriculumCourseCard)
  const coursesBySlug = new Map(courseCards.map((course) => [course.course.slug, course]))

  return {
    trackCards: TRACK_DEFINITIONS
      .map((definition) => buildCurriculumTrackCard(definition, coursesBySlug))
      .filter((track): track is CurriculumTrackCard => Boolean(track)),
    sections: SECTION_DEFINITIONS
      .map((definition) => buildCurriculumSection(definition, courseCards))
      .filter((section): section is CurriculumSection => Boolean(section))
  }
})
