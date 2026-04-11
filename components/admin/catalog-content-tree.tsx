import Link from "next/link"

import {
  cloneCourseAction,
  duplicateAssignmentAction,
  duplicateChapterAction,
  reorderAssignmentAction,
  reorderLessonAction,
  setChallengeVisibilityAction,
  setCourseTreeVisibilityAction,
  setCourseVisibilityAction,
  setLessonTreeVisibilityAction,
  setLessonVisibilityAction
} from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getLessonChallenges } from "@/lib/content/shared"
import type { Challenge, ContentSnapshot, Course, Lesson } from "@/lib/types"

type CatalogContentTreeProps = {
  snapshot: ContentSnapshot
  selection: {
    courseSlug?: string | null
    lessonSlug?: string | null
    challengeSlug?: string | null
  }
}

function getVisibilityLabel(published: boolean) {
  return published ? "Live" : "Hidden"
}

function getChallengeStatusLabel(challenge: { published: boolean; publicationState: string }) {
  if (!challenge.published || challenge.publicationState === "archived") {
    return "Hidden"
  }

  if (challenge.publicationState === "draft") {
    return "Draft"
  }

  return "Published"
}

function getLessonsForCourse(snapshot: ContentSnapshot, courseId: string) {
  return snapshot.lessons.filter((lesson) => lesson.courseId === courseId).sort((left, right) => left.orderIndex - right.orderIndex)
}

function getChallengesForLesson(snapshot: ContentSnapshot, lesson: Lesson) {
  return getLessonChallenges(lesson, snapshot.challenges, { includeHidden: true }) as Challenge[]
}

function buildAuthoringHref(courseSlug: string, lessonSlug: string, challengeSlug: string) {
  const params = new URLSearchParams({
    authorCourse: courseSlug,
    authorLesson: lessonSlug,
    authorAssignment: challengeSlug
  })

  return `/admin?${params.toString()}`
}

function getCourseSelection(snapshot: ContentSnapshot, course: Course) {
  const lesson = getLessonsForCourse(snapshot, course.id)[0] ?? null
  if (!lesson) {
    return null
  }

  const challenge = getChallengesForLesson(snapshot, lesson)[0] ?? null
  if (!challenge) {
    return null
  }

  return {
    courseSlug: course.slug,
    lessonSlug: lesson.slug,
    challengeSlug: challenge.slug
  }
}

function getLessonSelection(snapshot: ContentSnapshot, lesson: Lesson) {
  const challenge = getChallengesForLesson(snapshot, lesson)[0] ?? null
  if (!challenge) {
    return null
  }

  return {
    courseSlug: lesson.courseSlug,
    lessonSlug: lesson.slug,
    challengeSlug: challenge.slug
  }
}

function getSelectionRing(isSelected: boolean) {
  return isSelected ? "ring-2 ring-[var(--accent)]" : "ring-1 ring-[var(--border-subtle)]"
}

function AdminSelectionLink({
  label,
  href
}: {
  label: string
  href: string | null
}) {
  if (!href) {
    return <span className="text-sm text-[var(--ink-muted)]">{label}</span>
  }

  return (
    <Link href={href} className="text-sm font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)] underline-offset-4">
      {label}
    </Link>
  )
}

/**
 * Renders the authored catalog tree and exposes the high-volume admin actions
 * near each course, chapter, and assignment.
 */
export function CatalogContentTree({ snapshot, selection }: CatalogContentTreeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current content</CardTitle>
        <CardDescription>
          Review, open, clone, reorder, batch publish, or hide existing catalog content without hard-deleting authored work.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {snapshot.courses.length ? (
          snapshot.courses.map((course, courseIndex) => {
            const lessons = getLessonsForCourse(snapshot, course.id)
            const courseSelection = getCourseSelection(snapshot, course)
            const courseIsSelected = selection.courseSlug === course.slug

            return (
              <div
                key={course.id}
                className={`rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 ${getSelectionRing(courseIsSelected)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`L${courseIndex + 1}`}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[var(--ink-strong)]">{course.title}</p>
                      <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                        {getVisibilityLabel(course.published)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{course.summary}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AdminSelectionLink
                      label="Edit in authoring"
                      href={
                        courseSelection
                          ? buildAuthoringHref(courseSelection.courseSlug, courseSelection.lessonSlug, courseSelection.challengeSlug)
                          : null
                      }
                    />
                    <form action={cloneCourseAction}>
                      <input type="hidden" name="courseSlug" value={course.slug} />
                      <Button type="submit" variant="secondary" size="sm">
                        Clone course
                      </Button>
                    </form>
                    <form action={setCourseTreeVisibilityAction}>
                      <input type="hidden" name="courseSlug" value={course.slug} />
                      <input type="hidden" name="visibility" value={course.published ? "hidden" : "visible"} />
                      <Button type="submit" variant="secondary" size="sm">
                        {course.published ? "Hide full course" : "Publish full course"}
                      </Button>
                    </form>
                    <form action={setCourseVisibilityAction}>
                      <input type="hidden" name="courseSlug" value={course.slug} />
                      <input type="hidden" name="visibility" value={course.published ? "hidden" : "visible"} />
                      <Button type="submit" variant="ghost" size="sm">
                        {course.published ? "Hide course" : "Restore course"}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {lessons.map((lesson, lessonIndex) => {
                    const challenges = getChallengesForLesson(snapshot, lesson)
                    const lessonSelection = getLessonSelection(snapshot, lesson)
                    const lessonIsSelected = selection.lessonSlug === lesson.slug

                    return (
                      <div
                        key={lesson.id}
                        className={`rounded-[1.25rem] bg-[var(--surface-hover)] px-4 py-3 ${getSelectionRing(lessonIsSelected)}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`CH${lessonIndex + 1}`}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                              <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                                {getVisibilityLabel(lesson.published)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{lesson.summary}</p>
                          </div>

                          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                            <AdminSelectionLink
                              label="Edit chapter"
                              href={
                                lessonSelection
                                  ? buildAuthoringHref(lessonSelection.courseSlug, lessonSelection.lessonSlug, lessonSelection.challengeSlug)
                                  : null
                              }
                            />
                            {course.published && lesson.published ? (
                              <Link
                                href={`/learn/${lesson.courseSlug}/${lesson.slug}`}
                                className="text-sm font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)] underline-offset-4"
                              >
                                Open learner view
                              </Link>
                            ) : (
                              <span className="text-sm text-[var(--ink-muted)]">Hidden from learners</span>
                            )}
                            <form action={reorderLessonAction}>
                              <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                              <input type="hidden" name="lessonSlug" value={lesson.slug} />
                              <input type="hidden" name="direction" value="up" />
                              <Button type="submit" variant="secondary" size="sm" disabled={lessonIndex === 0}>
                                Move up
                              </Button>
                            </form>
                            <form action={reorderLessonAction}>
                              <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                              <input type="hidden" name="lessonSlug" value={lesson.slug} />
                              <input type="hidden" name="direction" value="down" />
                              <Button type="submit" variant="secondary" size="sm" disabled={lessonIndex === lessons.length - 1}>
                                Move down
                              </Button>
                            </form>
                            <form action={duplicateChapterAction}>
                              <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                              <input type="hidden" name="lessonSlug" value={lesson.slug} />
                              <Button type="submit" variant="secondary" size="sm">
                                Duplicate chapter
                              </Button>
                            </form>
                            <form action={setLessonTreeVisibilityAction}>
                              <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                              <input type="hidden" name="lessonSlug" value={lesson.slug} />
                              <input type="hidden" name="visibility" value={lesson.published ? "hidden" : "visible"} />
                              <Button type="submit" variant="secondary" size="sm">
                                {lesson.published ? "Hide chapter + assignments" : "Publish chapter + assignments"}
                              </Button>
                            </form>
                            <form action={setLessonVisibilityAction}>
                              <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                              <input type="hidden" name="lessonSlug" value={lesson.slug} />
                              <input type="hidden" name="visibility" value={lesson.published ? "hidden" : "visible"} />
                              <Button type="submit" variant="ghost" size="sm">
                                {lesson.published ? "Hide chapter" : "Restore chapter"}
                              </Button>
                            </form>
                          </div>
                        </div>

                        {challenges.length ? (
                          <div className="mt-4 grid gap-2">
                            {challenges.map((challenge, challengeIndex) => {
                              const challengeIsSelected = selection.challengeSlug === challenge.slug
                              const challengeIsVisible = challenge.published && challenge.publicationState !== "archived"

                              return (
                                <div
                                  key={challenge.id}
                                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[1rem] px-3 py-2 ${getSelectionRing(challengeIsSelected)} ${
                                    challengeIsVisible
                                      ? "bg-[var(--showcase-surface-soft)]"
                                      : "bg-[var(--surface-hover)] opacity-80"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`A${challengeIndex + 1}`}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">{challenge.title}</p>
                                      <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                                        {getChallengeStatusLabel(challenge)}
                                      </Badge>
                                    </div>
                                    {!challengeIsVisible ? (
                                      <p className="mt-1 text-xs leading-6 text-[var(--ink-muted)]">
                                        Hidden from learner routes. It stays here so you can restore it safely later.
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <AdminSelectionLink
                                      label="Edit assignment"
                                      href={buildAuthoringHref(lesson.courseSlug, lesson.slug, challenge.slug)}
                                    />
                                    <form action={reorderAssignmentAction}>
                                      <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                      <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                      <input type="hidden" name="challengeSlug" value={challenge.slug} />
                                      <input type="hidden" name="direction" value="up" />
                                      <Button type="submit" variant="secondary" size="sm" disabled={challengeIndex === 0}>
                                        Move up
                                      </Button>
                                    </form>
                                    <form action={reorderAssignmentAction}>
                                      <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                      <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                      <input type="hidden" name="challengeSlug" value={challenge.slug} />
                                      <input type="hidden" name="direction" value="down" />
                                      <Button type="submit" variant="secondary" size="sm" disabled={challengeIndex === challenges.length - 1}>
                                        Move down
                                      </Button>
                                    </form>
                                    <form action={duplicateAssignmentAction}>
                                      <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                      <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                      <input type="hidden" name="challengeSlug" value={challenge.slug} />
                                      <Button type="submit" variant="secondary" size="sm">
                                        Duplicate
                                      </Button>
                                    </form>
                                    <form action={setChallengeVisibilityAction}>
                                      <input type="hidden" name="courseSlug" value={lesson.courseSlug} />
                                      <input type="hidden" name="lessonSlug" value={lesson.slug} />
                                      <input type="hidden" name="challengeSlug" value={challenge.slug} />
                                      <input type="hidden" name="visibility" value={challenge.published ? "hidden" : "visible"} />
                                      <Button type="submit" variant="ghost" size="sm">
                                        {challenge.published ? "Hide assignment" : "Restore assignment"}
                                      </Button>
                                    </form>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-[var(--ink-muted)]">This chapter does not have any assignments yet.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-muted)]">No lessons have been created yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
