import Link from "next/link"
import { ArrowLeft, ArrowRight, Shuffle } from "lucide-react"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCoursePracticePageData } from "@/lib/data"

type PracticePageProps = {
  params: Promise<{
    courseSlug: string
  }>
}

function getBucketLabel(bucket: string) {
  if (bucket === "learning") {
    return "Learning"
  }

  if (bucket === "new") {
    return "Unseen"
  }

  if (bucket === "review") {
    return "Due review"
  }

  return "Stable"
}

export default async function CoursePracticeHubPage({ params }: PracticePageProps) {
  const { courseSlug } = await params
  const data = await getCoursePracticePageData(courseSlug)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(160deg,rgba(25,31,45,0.98),rgba(37,46,64,0.94))] text-white shadow-[0_28px_80px_rgba(11,15,24,0.18)]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-white/10 text-[var(--accent-soft)]">Practice hub</Badge>
              <Badge className="bg-white/8 text-white ring-1 ring-white/10">{`L${data.courseIndex}: ${data.course.title}`}</Badge>
            </div>
            <CardTitle className="font-serif text-5xl text-white">Smart shuffle for this practice path.</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7 text-white/74">
              Practice pulls from the whole path, then keeps misses, unseen questions, and due reviews near the front so
              each session feels fresh without losing repetition.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Link href={`/learn/${data.course.slug}`}>
              <Button variant="secondary" className="border-white/12 bg-white/8 text-white hover:bg-white/12">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to practice path
              </Button>
            </Link>
            {data.startHref ? (
              <Link href={data.startHref}>
                <Button className="bg-[var(--accent)] text-white hover:bg-[color:rgb(185_99_44)]">
                  <Shuffle className="mr-2 h-4 w-4" />
                  Start smart shuffle
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Learning</CardTitle>
              <CardDescription>Missed recently and worth revisiting soon.</CardDescription>
            </CardHeader>
            <CardContent className="text-4xl font-semibold text-[var(--ink-strong)]">
              {data.summary.learningCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Unseen</CardTitle>
              <CardDescription>Assignments you have never passed yet.</CardDescription>
            </CardHeader>
            <CardContent className="text-4xl font-semibold text-[var(--ink-strong)]">
              {data.summary.unseenCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Due</CardTitle>
              <CardDescription>Review work ready to come back now.</CardDescription>
            </CardHeader>
            <CardContent className="text-4xl font-semibold text-[var(--ink-strong)]">
              {data.summary.dueCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stable</CardTitle>
              <CardDescription>Assignments that can appear less often.</CardDescription>
            </CardHeader>
            <CardContent className="text-4xl font-semibold text-[var(--ink-strong)]">
              {data.summary.stableCount}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s queue preview</CardTitle>
            <CardDescription>
              The queue is rebuilt from one deep review module using the current path, your review history, and today&apos;s
              seed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.queuePreview.length ? (
              data.queuePreview.map((entry, index) => (
                <Link
                  key={`${entry.challengeSlug}:${index}`}
                  href={entry.href}
                  className="flex flex-col gap-3 rounded-[1.25rem] border border-black/8 bg-[color:rgb(25_31_45/0.03)] px-4 py-4 transition hover:bg-[color:rgb(25_31_45/0.05)]"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge>{getBucketLabel(entry.bucket)}</Badge>
                    <span className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                      {`CH${entry.lessonIndex + 1} · A${entry.challengeIndex + 1}`}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-strong)]">{entry.challengeTitle}</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">{entry.lessonTitle}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-black/10 px-4 py-5 text-sm leading-7 text-[var(--ink-muted)]">
                This path does not have any assignments ready for practice yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How this session behaves</CardTitle>
            <CardDescription>Simple rules now, room to grow later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-[var(--ink)]">
            <div className="rounded-[1.25rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-4">
              <p className="font-semibold text-[var(--ink-strong)]">1. Learning first</p>
              <p className="mt-1">Questions you missed recently stay near the front so correction happens while the mistake is still fresh.</p>
            </div>
            <div className="rounded-[1.25rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-4">
              <p className="font-semibold text-[var(--ink-strong)]">2. Unseen work next</p>
              <p className="mt-1">New assignments still enter the queue quickly so practice keeps expanding across the path.</p>
            </div>
            <div className="rounded-[1.25rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-4">
              <p className="font-semibold text-[var(--ink-strong)]">3. Due reviews after that</p>
              <p className="mt-1">Passed work returns on a simple staircase instead of a full flashcard algorithm.</p>
            </div>
            {data.startHref ? (
              <Link href={data.startHref}>
                <Button variant="secondary" className="w-full justify-center">
                  Continue into practice
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
