import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCoursePageData } from "@/lib/data"
import { formatRelativeMinutes } from "@/lib/utils"

type CoursePageProps = {
  params: Promise<{
    courseSlug: string
  }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const data = await getCoursePageData(courseSlug)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>{data.course.difficulty}</Badge>
        <h1 className="font-serif text-5xl tracking-tight text-[var(--ink-strong)]">{data.course.title}</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">{data.course.summary}</p>
      </section>

      <section className="grid gap-4">
        {data.lessons.map((lesson, index) => (
          <Card key={lesson.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Lesson {index + 1}</p>
                <p className="text-xl font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                <p className="max-w-2xl text-sm leading-7 text-[var(--ink)]">{lesson.summary}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                  {formatRelativeMinutes(lesson.estimatedMinutes)}
                </p>
              </div>
              <Link href={`/learn/${lesson.courseSlug}/${lesson.slug}`}>
                <Button>
                  Start lesson
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
