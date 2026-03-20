import Link from "next/link"
import { ArrowRight, BookOpenText, ChartNoAxesColumn, PenSquare, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCatalog, getCurrentUser } from "@/lib/data"
import { formatRelativeMinutes } from "@/lib/utils"

export default async function HomePage() {
  const catalog = await getCatalog()
  const user = await getCurrentUser()

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-12 px-4 py-14 sm:px-6 xl:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="space-y-6">
          <Badge>Text-first coding practice</Badge>
          <div className="space-y-5">
            <h1 className="max-w-4xl font-serif text-5xl tracking-tight text-[var(--ink-strong)] sm:text-6xl">
              Read a short lesson. Solve one challenge. Save progress. Continue tomorrow.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--ink)]">
              This scaffold is built around the exact product loop you chose. It keeps the learner experience focused
              while giving you a simple internal authoring panel for adding new coding exams quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/learn/backend-foundations">
              <Button size="lg">
                Enter the learner UI
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

        <Card className="overflow-hidden bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(255,243,232,0.96))]">
          <CardHeader>
            <CardTitle>Why this stack fits your goal</CardTitle>
            <CardDescription>
              You can use it privately now, then harden and monetize it later for a focused Philippines audience.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-[var(--ink)]">
            <div className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
              <p className="font-semibold text-[var(--ink-strong)]">Learner experience first</p>
              <p>Lesson text, code checks, and progress live in one loop instead of being spread across tools.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
              <p className="font-semibold text-[var(--ink-strong)]">Admin kept intentionally simple</p>
              <p>Raw MDX and code fields let you add new lessons fast before you invest in a polished CMS.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
              <p className="font-semibold text-[var(--ink-strong)]">Scales where it matters</p>
              <p>Supabase handles auth and progress; the runner stays isolated behind an API boundary.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <Card className="bg-[var(--ink-strong)] text-white">
          <CardHeader>
            <CardTitle className="text-white">The core product loop</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/80">
            <div className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <BookOpenText className="mt-1 h-5 w-5 text-[var(--accent-soft)]" />
              <div>
                <p className="font-semibold text-white">Read a short lesson</p>
                <p>Keep every lesson small enough to finish in one session.</p>
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
                <p>Resume state and lesson completion are stored separately so returning feels instant.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <PenSquare className="mt-1 h-5 w-5 text-[var(--accent-soft)]" />
              <div>
                <p className="font-semibold text-white">Author more exams easily</p>
                <p>One admin form creates the course link, lesson text, prompt, starter code, and hidden tests.</p>
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
                  <p className="font-semibold text-[var(--ink-strong)]">{lessons.length} lesson</p>
                  <p className="mt-1">First step takes about {formatRelativeMinutes(lessons[0]?.estimatedMinutes ?? 10)}.</p>
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
