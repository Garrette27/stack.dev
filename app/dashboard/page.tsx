import Link from "next/link"
import { ArrowRight, Clock3, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardState, getCurrentUser } from "@/lib/data"

export default async function DashboardPage() {
  const [user, state] = await Promise.all([getCurrentUser(), getDashboardState()])

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-[linear-gradient(160deg,rgba(25,31,45,0.96),rgba(45,55,72,0.92))] text-white">
          <CardHeader>
            <Badge className="w-fit bg-white/12 text-[var(--accent-soft)]">Dashboard</Badge>
            <CardTitle className="font-serif text-4xl text-white">
              {user ? `Welcome back, ${user.user_metadata?.full_name ?? "learner"}.` : "Track your progress."}
            </CardTitle>
            <CardDescription className="text-white/70">
              See what you have finished, what is active, and where to continue next.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="min-h-[112px] rounded-[1.5rem] border border-white/10 bg-white/7 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Courses</p>
              <p className="mt-2 text-3xl font-semibold text-white">{state.courseCount}</p>
            </div>
            <div className="min-h-[112px] rounded-[1.5rem] border border-white/10 bg-white/7 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Completed</p>
              <p className="mt-2 text-3xl font-semibold text-white">{state.completedLessons}</p>
            </div>
            <div className="min-h-[112px] rounded-[1.5rem] border border-white/10 bg-white/7 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">In progress</p>
              <p className="mt-2 text-3xl font-semibold text-white">{state.inProgressLessons}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Continue where you left off</CardTitle>
            <CardDescription>Jump back into your current lesson without searching through the course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.resumeTarget ? (
              <>
                <div className="rounded-[1.5rem] bg-[color:rgb(201_111_54/0.08)] p-4 text-sm leading-7 text-[var(--ink)]">
                  <p className="font-semibold text-[var(--ink-strong)]">Current resume target</p>
                  <p className="mt-1">
                    {state.resumeTarget.courseSlug} / {state.resumeTarget.lessonSlug}
                  </p>
                </div>
                <Link href={`/learn/${state.resumeTarget.courseSlug}/${state.resumeTarget.lessonSlug}`}>
                  <Button>
                    Resume lesson
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-muted)]">
                Start one lesson, then the app will keep your place here automatically.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid auto-rows-fr gap-5 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-[var(--accent)]" />
              Total lessons
            </CardTitle>
          </CardHeader>
          <CardContent className="text-4xl font-semibold text-[var(--ink-strong)]">
            <p>{state.lessonCount}</p>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[var(--accent)]" />
              Keep momentum
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-[var(--ink)]">
            Short, regular sessions work better than giant bursts. Keep the next lesson obvious and easy to resume.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5">
        <div>
          <h2 className="font-serif text-3xl tracking-tight text-[var(--ink-strong)]">Recent lessons</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">Open the next lesson directly from here.</p>
        </div>
        <div className="grid gap-4">
          {state.recentLessons.map((lesson) => (
            <Card key={lesson.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Badge>{lesson.status.replace("_", " ")}</Badge>
                    <span className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{lesson.courseTitle}</span>
                  </div>
                  <p className="text-lg font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                  <p className="text-sm text-[var(--ink-muted)]">{lesson.summary}</p>
                </div>
                <Link href={`/learn/${lesson.courseSlug}/${lesson.slug}`}>
                  <Button variant="secondary">
                    Open lesson
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
