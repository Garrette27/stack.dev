import Link from "next/link"
import { LockKeyhole } from "lucide-react"

import { AdminAccessCard } from "@/components/admin/admin-access-card"
import { AuthoringForm } from "@/components/admin/authoring-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminPageState } from "@/lib/admin"

export default async function AdminPage() {
  const { user, isAdmin, canClaimFirstAdmin, snapshot } = await getAdminPageState()

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="bg-[linear-gradient(160deg,rgba(201,111,54,0.96),rgba(219,145,80,0.92))] text-white">
          <CardHeader>
            <Badge className="w-fit bg-white/12 text-white">Authoring</Badge>
            <CardTitle className="max-w-4xl font-serif text-4xl leading-[1.05] text-white">
              Choose a path, choose a chapter, write an assignment.
            </CardTitle>
            <CardDescription className="text-white/80">Save content here, then open the learner page to test the exact chapter and assignment.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/85">
            <p>Each save updates the selected learning path and chapter, then attaches the authored assignment to that chapter.</p>
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

      {!user ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
              Sign in required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-[var(--ink)]">
            <p>Sign in with the Google account you want to use for authoring.</p>
            <Link href="/login" className="font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]">
              Go to login
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {user && !isAdmin ? <AdminAccessCard canClaimFirstAdmin={canClaimFirstAdmin} /> : null}

      {user && isAdmin ? <AuthoringForm snapshot={snapshot} /> : null}

      <section className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Current content</CardTitle>
            <CardDescription>Use this as the source of truth for which chapters already exist inside each learning path.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.courses.length ? (
              snapshot.courses.map((course, courseIndex) => {
                const lessons = snapshot.lessons
                  .filter((lesson) => lesson.courseId === course.id)
                  .sort((left, right) => left.orderIndex - right.orderIndex)

                return (
                  <div key={course.id} className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`L${courseIndex + 1}`}</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{course.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{course.summary}</p>

                    <div className="mt-4 grid gap-3">
                      {lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="rounded-[1.25rem] bg-[color:rgb(25_31_45/0.03)] px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`CH${lessonIndex + 1}`}</p>
                              <p className="mt-1 text-base font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                              <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{lesson.summary}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                                {lesson.challengeIds.length} assignment{lesson.challengeIds.length === 1 ? "" : "s"}
                              </p>
                              <Link
                                href={`/learn/${lesson.courseSlug}/${lesson.slug}`}
                                className="mt-2 inline-flex text-sm font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]"
                              >
                                Open learner view
                              </Link>
                            </div>
                          </div>
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
