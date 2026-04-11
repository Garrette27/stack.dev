import { notFound } from "next/navigation"

import { AnalyticsOverview } from "@/components/admin/analytics-overview"
import { AuthoringForm } from "@/components/admin/authoring-form"
import { CatalogContentTree } from "@/components/admin/catalog-content-tree"
import { CatalogHistoryPanel } from "@/components/admin/catalog-history-panel"
import { CatalogImportPanel } from "@/components/admin/catalog-import-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminPageState } from "@/lib/admin"
import { getAdminCatalogHistorySnapshot } from "@/lib/admin/catalog-history"
import type { PersistedAuthoringSelection } from "@/lib/admin/authoring-session"
import { getAdminAnalyticsSnapshot, normalizeAnalyticsAudience, normalizeAnalyticsRange } from "@/lib/analytics"
import { getLessonChallenges } from "@/lib/content/shared"
import type { Challenge, ContentSnapshot, Lesson } from "@/lib/types"

type AdminPageProps = {
  searchParams?: Promise<{
    analyticsRange?: string | string[]
    analyticsAudience?: string | string[]
    authorCourse?: string | string[]
    authorLesson?: string | string[]
    authorAssignment?: string | string[]
  }>
}

export const dynamic = "force-dynamic"

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getLessonsForCourse(snapshot: ContentSnapshot, courseId: string) {
  return snapshot.lessons.filter((lesson) => lesson.courseId === courseId).sort((left, right) => left.orderIndex - right.orderIndex)
}

function getChallengesForLesson(snapshot: ContentSnapshot, lesson: Lesson) {
  return getLessonChallenges(lesson, snapshot.challenges, { includeHidden: true }) as Challenge[]
}

function buildCatalogImportTargets(snapshot: ContentSnapshot) {
  return snapshot.courses.map((course) => ({
    slug: course.slug,
    title: course.title,
    lessons: getLessonsForCourse(snapshot, course.id).map((lesson) => ({
      slug: lesson.slug,
      title: lesson.title
    }))
  }))
}

function resolveInitialAuthoringSelection(
  snapshot: ContentSnapshot,
  selection: {
    courseSlug?: string | null
    lessonSlug?: string | null
    challengeSlug?: string | null
  }
): PersistedAuthoringSelection | null {
  const course =
    (selection.courseSlug ? snapshot.courses.find((candidate) => candidate.slug === selection.courseSlug) : null) ??
    snapshot.courses[0] ??
    null

  if (!course) {
    return null
  }

  const lessons = getLessonsForCourse(snapshot, course.id)
  const lesson =
    (selection.lessonSlug ? lessons.find((candidate) => candidate.slug === selection.lessonSlug) : null) ??
    lessons[0] ??
    null

  if (!lesson) {
    return null
  }

  const challenges = getChallengesForLesson(snapshot, lesson)
  const challenge =
    (selection.challengeSlug ? challenges.find((candidate) => candidate.slug === selection.challengeSlug) : null) ??
    challenges[0] ??
    null

  if (!challenge) {
    return null
  }

  return {
    courseSlug: course.slug,
    lessonSlug: lesson.slug,
    challengeSlug: challenge.slug
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const analyticsRange = normalizeAnalyticsRange(firstQueryValue(resolvedSearchParams.analyticsRange))
  const analyticsAudience = normalizeAnalyticsAudience(firstQueryValue(resolvedSearchParams.analyticsAudience))
  const historySelection = {
    courseSlug: firstQueryValue(resolvedSearchParams.authorCourse) ?? null,
    lessonSlug: firstQueryValue(resolvedSearchParams.authorLesson) ?? null,
    challengeSlug: firstQueryValue(resolvedSearchParams.authorAssignment) ?? null
  }

  const [{ user, isAdmin, snapshot }, history, analytics] = await Promise.all([
    getAdminPageState(),
    getAdminCatalogHistorySnapshot(historySelection),
    getAdminAnalyticsSnapshot({
      range: analyticsRange,
      audience: analyticsAudience
    })
  ])

  if (!user || !isAdmin) {
    notFound()
  }

  const initialSelection = resolveInitialAuthoringSelection(snapshot, historySelection)
  const importSelection = {
    courseSlug: historySelection.courseSlug ?? initialSelection?.courseSlug ?? null,
    lessonSlug: historySelection.lessonSlug ?? initialSelection?.lessonSlug ?? null
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="bg-[linear-gradient(160deg,rgba(201,111,54,0.96),rgba(219,145,80,0.92))] text-white">
          <CardHeader>
            <Badge className="w-fit bg-white/12 text-white">Authoring</Badge>
            <CardTitle className="max-w-4xl font-serif text-4xl leading-[1.05] text-white">
              Choose a course, choose a chapter, write an assignment.
            </CardTitle>
            <CardDescription className="text-white/80">Save content here, then open the learner page to test the exact chapter and assignment.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/85">
            <p>Each save updates the selected course and chapter, then attaches the authored assignment to that chapter.</p>
            <p>Use the chapter picker to append a new assignment without replacing the existing ones.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.courses.length}</CardTitle>
              <CardDescription>Courses</CardDescription>
            </CardHeader>
          </Card>
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.lessons.length}</CardTitle>
              <CardDescription>Lessons</CardDescription>
            </CardHeader>
          </Card>
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.challenges.length}</CardTitle>
              <CardDescription>Challenges</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <AuthoringForm snapshot={snapshot} initialSelection={initialSelection} />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <CatalogContentTree snapshot={snapshot} selection={historySelection} />
        <div className="grid gap-6">
          <CatalogHistoryPanel history={history} selection={historySelection} />
          <CatalogImportPanel
            targets={buildCatalogImportTargets(snapshot)}
            defaultCourseSlug={importSelection.courseSlug}
            defaultLessonSlug={importSelection.lessonSlug}
          />
        </div>
      </section>

      <AnalyticsOverview snapshot={analytics} />
    </div>
  )
}
