import Link from "next/link"
import { notFound } from "next/navigation"

import { AnalyticsOverview } from "@/components/admin/analytics-overview"
import { AuthoringForm } from "@/components/admin/authoring-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminPageState } from "@/lib/admin"
import { getAdminAnalyticsSnapshot, normalizeAnalyticsAudience, normalizeAnalyticsRange } from "@/lib/analytics"
import { deleteChallengeAction, deleteCourseAction, deleteLessonAction } from "./actions"

type AdminPageProps = {
  searchParams?: Promise<{
    analyticsRange?: string | string[]
    analyticsAudience?: string | string[]
    authorCourse?: string | string[]
    authorLesson?: string | string[]
    authorAssignment?: string | string[]
  }>
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const analyticsRange = normalizeAnalyticsRange(firstQueryValue(resolvedSearchParams.analyticsRange))
  const analyticsAudience = normalizeAnalyticsAudience(firstQueryValue(resolvedSearchParams.analyticsAudience))
  const initialSelection =
    firstQueryValue(resolvedSearchParams.authorCourse) &&
    firstQueryValue(resolvedSearchParams.authorLesson) &&
    firstQueryValue(resolvedSearchParams.authorAssignment)
      ? {
          courseSlug: firstQueryValue(resolvedSearchParams.authorCourse) as string,
          lessonSlug: firstQueryValue(resolvedSearchParams.authorLesson) as string,
          challengeSlug: firstQueryValue(resolvedSearchParams.authorAssignment) as string
        }
      : null

  const [{ user, isAdmin, snapshot }, analytics] = await Promise.all([
    getAdminPageState(),
    getAdminAnalyticsSnapshot({
      range: analyticsRange,
      audience: analyticsAudience
    })
  ])

  if (!user || !isAdmin) {
    notFound()
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

      <AnalyticsOverview snapshot={analytics} />

      <section className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Current content</CardTitle>
            <CardDescription>Use this to edit or remove existing courses, chapters, and assignments.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.courses.length ? (
              snapshot.courses.map((course, courseIndex) => {
                const lessons = snapshot.lessons
                  .filter((lesson) => lesson.courseId === course.id)
                  .sort((left, right) => left.orderIndex - right.orderIndex)

                return (
                  <div key={course.id} className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`L${courseIndex + 1}`}</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{course.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{course.summary}</p>
                      </div>
                      <form action={deleteCourseAction}>
                        <input type="hidden" name="courseSlug" value={course.slug} />
                        <Button type="submit" variant="destructive" size="sm">
                          Delete course
                        </Button>
                      </form>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="rounded-[1.25rem] bg-[color:rgb(25_31_45/0.03)] px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`CH${lessonIndex + 1}`}</p>
                              <p className="mt-1 text-base font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                              <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{lesson.summary}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-right">
                              <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                                {lesson.challengeIds.length} assignment{lesson.challengeIds.length === 1 ? "" : "s"}
                              </p>
                              <Link
                                href={`/learn/${lesson.courseSlug}/${lesson.slug}`}
                                className="inline-flex text-sm font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]"
                              >
                                Open learner view
                              </Link>
                              <form action={deleteLessonAction}>
                                <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                <Button type="submit" variant="destructive" size="sm">
                                  Delete chapter
                                </Button>
                              </form>
                            </div>
                          </div>

                          {lesson.challengeIds.length ? (
                            <div className="mt-4 grid gap-2">
                              {lesson.challengeIds.map((challengeId, challengeIndex) => {
                                const challenge = snapshot.challenges.find((item) => item.id === challengeId)
                                if (!challenge) {
                                  return null
                                }

                                return (
                                  <div
                                    key={challenge.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-white/75 px-3 py-2 ring-1 ring-black/6"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`A${challengeIndex + 1}`}</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">{challenge.title}</p>
                                        <Badge className="bg-white text-[var(--ink-muted)] ring-1 ring-black/8">
                                          {challenge.publicationState === "draft" ? "Draft" : challenge.publicationState === "archived" ? "Archived" : "Published"}
                                        </Badge>
                                      </div>
                                    </div>
                                    <form action={deleteChallengeAction}>
                                      <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                      <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                      <input type="hidden" name="challengeSlug" value={challenge.slug} />
                                      <Button type="submit" variant="destructive" size="sm">
                                        Delete assignment
                                      </Button>
                                    </form>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-muted)]">No lessons have been created yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
