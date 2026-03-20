import Link from "next/link"
import { ArrowLeft, BookMarked, Clock3, Sparkles } from "lucide-react"
import { notFound } from "next/navigation"

import { ChallengeWorkbench } from "@/components/code/challenge-workbench"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser, getLessonPageData } from "@/lib/data"
import { MdxRenderer } from "@/lib/mdx"
import { formatRelativeMinutes } from "@/lib/utils"

type LessonPageProps = {
  params: Promise<{
    courseSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params
  const [data, user] = await Promise.all([getLessonPageData(courseSlug, lessonSlug), getCurrentUser()])

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-10 sm:px-6 xl:px-10">
      <section className="relative overflow-hidden rounded-[2.75rem] border border-black/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,244,236,0.98))] p-7 shadow-[0_28px_80px_rgba(25,31,45,0.08)] sm:p-10">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[color:rgb(201_111_54/0.16)] blur-3xl" />
        <div className="absolute bottom-0 right-[14%] h-24 w-24 rounded-full bg-[color:rgb(25_31_45/0.08)] blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:items-end">
          <div className="space-y-6">
            <Link href={`/learn/${data.course.slug}`} className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)]">
              <ArrowLeft className="h-4 w-4" />
              Back to course
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{data.course.title}</Badge>
              <Badge className="bg-white/85 text-[var(--ink-strong)] ring-1 ring-black/8">
                {formatRelativeMinutes(data.lesson.estimatedMinutes)}
              </Badge>
            </div>
            <div className="space-y-5">
              <h1 className="max-w-5xl font-serif text-5xl tracking-tight text-[var(--ink-strong)] sm:text-6xl">
                {data.lesson.title}
              </h1>
              <p className="max-w-4xl text-lg leading-9 text-[var(--ink)] sm:text-xl">
                {data.lesson.summary}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[2rem] border border-black/8 bg-white/80 p-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-1 h-5 w-5 text-[var(--accent)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Cadence</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                    {formatRelativeMinutes(data.lesson.estimatedMinutes)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    One focused session. Enough context to learn, enough constraint to finish.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-[color:rgb(25_31_45/0.04)] p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 text-[var(--accent)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Learning loop</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">Read, code, check, continue.</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Keep the loop short and obvious.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-10 2xl:grid-cols-[minmax(420px,0.62fr)_minmax(0,1.38fr)]">
        <Card className="h-fit overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,250,245,0.92))]">
          <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.72)] p-7 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Read first</p>
                <CardTitle className="mt-3 flex items-center gap-2 font-serif text-3xl">
                  <BookMarked className="h-5 w-5 text-[var(--accent)]" />
                  Lesson text
                </CardTitle>
              </div>
              <Badge>{data.course.title}</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-w-none p-7 pt-6 sm:p-8 sm:pt-6">
            <MdxRenderer source={data.lesson.bodyMdx} />
          </CardContent>
        </Card>

        {data.challenge ? (
          <div className="grid gap-6">
            <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,241,0.94))]">
              <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.78)] p-7 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">Do next</Badge>
                  <Badge>{data.challenge.language}</Badge>
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Challenge brief</p>
                <CardTitle className="mt-3 font-serif text-4xl">{data.challenge.title}</CardTitle>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">Read the prompt, then solve it in the editor below.</p>
              </CardHeader>
              <CardContent className="max-w-none p-7 sm:p-8">
                <MdxRenderer source={data.challenge.promptMdx} />
              </CardContent>
            </Card>
            <ChallengeWorkbench
              challenge={data.challenge}
              courseSlug={courseSlug}
              lessonSlug={lessonSlug}
              isAuthenticated={Boolean(user)}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No challenge linked yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-[var(--ink)]">
              Add a challenge from the authoring page when you are ready to turn this lesson into practice.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
