"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { CurriculumSection } from "@/lib/curriculum"
import { formatRelativeMinutes } from "@/lib/utils"

type CourseCatalogProps = {
  sections: CurriculumSection[]
}

type CatalogFilter = "all" | CurriculumSection["slug"]

type FilterOption = {
  value: CatalogFilter
  label: string
}

function getSearchableText(section: CurriculumSection, courseTitle: string, summary: string, kindLabel: string) {
  return `${section.title} ${courseTitle} ${summary} ${kindLabel}`.toLowerCase()
}

function getCourseCatalogCta(kindLabel: string, status: string) {
  const normalizedKind = kindLabel.toLowerCase()

  if (status === "not_started") {
    return normalizedKind === "course" ? "Open course" : `Open ${normalizedKind}`
  }

  if (normalizedKind === "course") {
    return "Continue course"
  }

  return `Continue ${normalizedKind}`
}

/**
 * Keeps course-catalog filtering and grouping inside one learner-facing module
 * so the `/learn` page can stay a thin server wrapper around published
 * curriculum data.
 */
export function CourseCatalog({ sections }: CourseCatalogProps) {
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>("all")

  const totalItemCount = useMemo(
    () => sections.reduce((total, section) => total + section.courses.length, 0),
    [sections]
  )

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      {
        value: "all",
        label: `All (${totalItemCount})`
      },
      ...sections.map((section) => ({
        value: section.slug,
        label: `${section.title} (${section.courses.length})`
      }))
    ],
    [sections, totalItemCount]
  )

  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return sections
      .map((section) => {
        if (activeFilter !== "all" && section.slug !== activeFilter) {
          return {
            ...section,
            courses: []
          }
        }

        return {
          ...section,
          courses: section.courses.filter(({ course, kindLabel }) => {
            if (!normalizedQuery) {
              return true
            }

            return getSearchableText(section, course.title, course.summary, kindLabel).includes(normalizedQuery)
          })
        }
      })
      .filter((section) => section.courses.length > 0)
  }, [activeFilter, query, sections])

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <Badge className="w-fit">Course Catalog</Badge>
        <h1 className="max-w-5xl font-serif text-5xl tracking-tight text-[var(--ink-strong)]">Browse every published course, project, and training block.</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">
          Explore the full catalog in one place, then open the course you want without being forced into a preset path.
        </p>
      </section>

      <section className="grid gap-4 rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--showcase-surface-soft)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={activeFilter === option.value ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Search catalog</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, summary, or category"
              className="pl-11"
            />
          </div>
        </label>
      </section>

      {visibleSections.length ? (
        visibleSections.map((section) => (
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
              {section.courses.map(({ course, lessons, kindLabel, progress }) => (
                <Card key={course.id} className="overflow-hidden">
                  <div className="h-2" style={{ backgroundColor: course.accent }} />
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{kindLabel}</Badge>
                      <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">{course.difficulty}</Badge>
                      <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">
                        {progress.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>{course.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-4 text-sm leading-7 text-[var(--ink)]">
                      <p>
                        {progress.completedLessonCount} / {progress.totalLessonCount} chapter
                        {progress.totalLessonCount === 1 ? "" : "s"} completed
                      </p>
                      <p>
                        {progress.completedChallengeCount} / {progress.totalChallengeCount} assignment
                        {progress.totalChallengeCount === 1 ? "" : "s"} completed
                      </p>
                      <p>First chapter takes about {formatRelativeMinutes(lessons[0]?.estimatedMinutes ?? 10)}.</p>
                    </div>
                    <Link href={progress.courseHref}>
                      <Button variant="secondary">
                        {getCourseCatalogCta(kindLabel, progress.status)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>No matching courses yet</CardTitle>
            <CardDescription>Try a different search term or catalog filter.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
