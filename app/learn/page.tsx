import Link from "next/link"
import { ArrowRight, Layers3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCatalog } from "@/lib/data"

/**
 * Presents the published learning paths so the top-level Learn nav does not
 * depend on any one hard-coded course slug.
 */
export default async function LearnIndexPage() {
  const catalog = await getCatalog()

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>Learning paths</Badge>
        <h1 className="font-serif text-5xl tracking-tight text-[var(--ink-strong)]">Choose where to start.</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">
          Browse the published paths, open a chapter, and keep moving through assignments at your own pace.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {catalog.map(({ course, lessons }) => (
          <Card key={course.id} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <Layers3 className="h-4 w-4" />
                <CardDescription>{course.difficulty}</CardDescription>
              </div>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>{course.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-4 text-sm leading-7 text-[var(--ink)]">
                <p>{lessons.length} chapter{lessons.length === 1 ? "" : "s"}</p>
                <p>
                  {lessons.reduce((total, lesson) => total + lesson.challengeIds.length, 0)} assignment
                  {lessons.reduce((total, lesson) => total + lesson.challengeIds.length, 0) === 1 ? "" : "s"}
                </p>
              </div>
              <Link href={`/learn/${course.slug}`}>
                <Button>
                  Open path
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
