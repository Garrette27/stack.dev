import Link from "next/link"
import { ArrowRight, Route, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurriculumLandingPageData } from "@/lib/data"
import { formatRelativeMinutes } from "@/lib/utils"

/**
 * Presents the learner catalog as paths and shelves so the app can grow beyond
 * a flat list of courses without changing the underlying content model.
 */
export default async function LearnIndexPage() {
  const curriculum = await getCurriculumLandingPageData()

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-10 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>Curriculum</Badge>
        <h1 className="max-w-5xl font-serif text-5xl tracking-tight text-[var(--ink-strong)]">
          Choose your next course, project, or focused training block.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">
          The catalog is now prepared for larger learning paths, guided projects, portfolio milestones, and deeper
          follow-up topics without forcing every experience into one flat list.
        </p>
      </section>

      {curriculum.trackCards.length ? (
        <section className="grid gap-5">
          <div className="space-y-2">
            <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">Curated paths</Badge>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--ink-strong)]">Start from a larger path</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
              These path cards sit above individual courses so you can scale into Boot.dev-style learning tracks later
              without rebuilding the content model.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {curriculum.trackCards.map((track) => (
              <Card key={track.slug} className="overflow-hidden bg-[linear-gradient(160deg,rgba(25,31,45,0.96),rgba(45,55,72,0.92))] text-white">
                <CardHeader>
                  <div className="flex items-center gap-2 text-[var(--accent-soft)]">
                    <Route className="h-4 w-4" />
                    <CardDescription className="text-white/72">
                      {track.availableCourseCount} of {track.configuredCourseCount} courses live
                    </CardDescription>
                  </div>
                  <CardTitle className="text-white">{track.title}</CardTitle>
                  <CardDescription className="text-white/78">{track.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/6 p-4 text-sm leading-7 text-white/82">
                    <p>{track.totalLessons} chapters currently available</p>
                    <p>{track.totalChallenges} assignments currently available</p>
                  </div>
                  {track.primaryHref ? (
                    <Link href={track.primaryHref}>
                      <Button variant="secondary">
                        {track.primaryCourseTitle ? `Start with ${track.primaryCourseTitle}` : "Open path"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {curriculum.sections.map((section) => (
        <section key={section.slug} className="grid gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">
                {section.courses.length} item{section.courses.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--ink-strong)]">{section.title}</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">{section.description}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {section.courses.map(({ course, lessons, kindLabel, totalLessons, totalChallenges }) => (
              <Card key={course.id} className="overflow-hidden">
                <div className="h-2" style={{ backgroundColor: course.accent }} />
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{kindLabel}</Badge>
                    <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">{course.difficulty}</Badge>
                  </div>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription>{course.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-4 text-sm leading-7 text-[var(--ink)]">
                    <p>{totalLessons} chapter{totalLessons === 1 ? "" : "s"}</p>
                    <p>{totalChallenges} assignment{totalChallenges === 1 ? "" : "s"}</p>
                    <p>First chapter takes about {formatRelativeMinutes(lessons[0]?.estimatedMinutes ?? 10)}.</p>
                  </div>
                  <Link href={`/learn/${course.slug}`}>
                    <Button variant="secondary">
                      Open {kindLabel.toLowerCase()}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {!curriculum.sections.length ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Sparkles className="h-4 w-4" />
              <CardDescription>Curriculum is ready</CardDescription>
            </div>
            <CardTitle>No published courses yet</CardTitle>
            <CardDescription>
              The curriculum layer is in place. Once you publish more courses, projects, or training content, they will
              group into the right shelves automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  )
}
