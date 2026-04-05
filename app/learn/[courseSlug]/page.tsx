import Link from "next/link"
import { ArrowRight, Shuffle } from "lucide-react"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCoursePageData, getCoursePracticePageData } from "@/lib/data"

type CoursePageProps = {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const [data, practice] = await Promise.all([getCoursePageData(courseSlug), getCoursePracticePageData(courseSlug)])

  if (!data || !practice) {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>{data.course.difficulty}</Badge>
        <h1 className="font-serif text-5xl tracking-tight text-[var(--ink-strong)]">{data.course.title}</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">{data.course.summary}</p>
      </section>

      <section>
        <Card className="overflow-hidden border-none bg-[linear-gradient(160deg,rgba(25,31,45,0.98),rgba(37,46,64,0.94))] text-white shadow-[0_28px_80px_rgba(11,15,24,0.18)]">
          <CardHeader className="grid gap-5 border-b border-white/10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
            <div className="space-y-3">
              <Badge className="w-fit bg-white/10 text-[var(--accent-soft)]">Practice hub</Badge>
              <CardTitle className="font-serif text-4xl text-white">Practice this path with an intelligent shuffle.</CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-white/72">
                Keep misses, unseen work, and due reviews near the front without losing the freshness of a shuffled session.
              </CardDescription>
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4 text-sm text-white/80">
              <p className="font-semibold uppercase tracking-[0.2em] text-white/45">Today&apos;s mix</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1rem] bg-white/7 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Learning</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{practice.summary.learningCount}</p>
                </div>
                <div className="rounded-[1rem] bg-white/7 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Unseen</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{practice.summary.unseenCount}</p>
                </div>
                <div className="rounded-[1rem] bg-white/7 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Due</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{practice.summary.dueCount}</p>
                </div>
                <div className="rounded-[1rem] bg-white/7 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Stable</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{practice.summary.stableCount}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2 text-sm leading-7 text-white/75">
              <p>
                The practice hub builds one course-wide queue behind the scenes, so you can review across chapters without
                manually hopping around the path.
              </p>
              <p>Use it when you want repetition and freshness, not a fixed chapter-by-chapter pass.</p>
            </div>
            <Link href={`/learn/${data.course.slug}/practice`}>
              <Button className="min-w-[220px] bg-[var(--accent)] text-white hover:bg-[color:rgb(185_99_44)]">
                <Shuffle className="mr-2 h-4 w-4" />
                Open practice hub
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        {data.lessons.map((lesson, index) => (
          <Card key={lesson.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{`CH${index + 1}`}</p>
                <p className="text-xl font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                <p className="max-w-2xl text-sm leading-7 text-[var(--ink)]">{lesson.summary}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {lesson.challengeIds.length} assignment{lesson.challengeIds.length === 1 ? "" : "s"}
                </p>
              </div>
              <Link href={`/learn/${lesson.courseSlug}/${lesson.slug}`}>
                <Button>
                  Start session
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
