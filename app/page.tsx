import Link from "next/link"
import { ArrowRight, BookOpenText, ChartNoAxesColumn, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCatalog, getCurrentUser } from "@/lib/data"
import { formatRelativeMinutes } from "@/lib/utils"

export default async function HomePage() {
  const catalog = await getCatalog()
  const user = await getCurrentUser()
  const primaryPracticeHref = "/learn"

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-12 px-4 py-14 sm:px-6 xl:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="space-y-6">
          <Badge>Text-first coding practice</Badge>
          <div className="space-y-5">
            <h1 className="max-w-4xl font-serif text-5xl tracking-tight text-[var(--ink-strong)] sm:text-6xl">
              Read a short guide. Run a practical coding session. Save progress. Continue tomorrow.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--ink)]">
              Build skill with short readings, practical exercises, and a session flow designed to keep your reps steady
              and useful.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={primaryPracticeHref}>
              <Button size="lg">
                Browse course catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={user ? "/dashboard" : "/login"}>
              <Button variant="secondary" size="lg">
                {user ? "Open dashboard" : "Sign in with Google"}
              </Button>
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden bg-[linear-gradient(160deg,var(--showcase-surface),var(--surface))]">
          <CardHeader>
            <CardTitle>Why practice sticks</CardTitle>
            <CardDescription>
              A practice-first flow for learners who want steady reps, not another bloated course outline.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-[var(--ink)]">
            <div className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 ring-1 ring-[var(--border-soft)]">
              <p className="font-semibold text-[var(--ink-strong)]">Short sessions that finish</p>
              <p>Each session is small enough to complete in one sitting, even on a busy schedule.</p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 ring-1 ring-[var(--border-soft)]">
              <p className="font-semibold text-[var(--ink-strong)]">Practice over passive reading</p>
              <p>Read the concept, solve a challenge, and get feedback without leaving the practice flow.</p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 ring-1 ring-[var(--border-soft)]">
              <p className="font-semibold text-[var(--ink-strong)]">Progress that keeps up with you</p>
              <p>Resume exactly where you stopped so your study habit does not break every time life gets busy.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <Card className="bg-[var(--inverse-surface)] text-white">
          <CardHeader>
            <CardTitle className="text-white">How the platform helps you keep going</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/80">
            <div className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <BookOpenText className="mt-1 h-5 w-5 text-[var(--accent-soft)]" />
              <div>
                <p className="font-semibold text-white">Read a short guide</p>
                <p>Keep every practical session small enough to finish in one sitting.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-[var(--accent-soft)]" />
              <div>
                <p className="font-semibold text-white">Get checked automatically</p>
                <p>Hidden tests stay on the server so the learner sees feedback without seeing the answer key.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <ChartNoAxesColumn className="mt-1 h-5 w-5 text-[var(--accent-soft)]" />
              <div>
                <p className="font-semibold text-white">Never lose progress</p>
                <p>Resume state and session completion are stored separately so returning feels instant.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          {catalog.map(({ course, lessons }) => (
            <Card key={course.id} className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: course.accent }} />
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{course.title}</CardTitle>
                  <Badge>{course.difficulty}</Badge>
                </div>
                <CardDescription>{course.summary}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-4 text-sm text-[var(--ink)]">
                  <p className="font-semibold text-[var(--ink-strong)]">
                    {lessons.length} practice session{lessons.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1">First practice session takes about {formatRelativeMinutes(lessons[0]?.estimatedMinutes ?? 10)}.</p>
                </div>
                <Link href={`/learn/${course.slug}`}>
                  <Button variant="secondary">
                    Open course
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
