"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

import type { Lesson } from "@/lib/types"

type CourseProgressStripProps = {
  courseSlug: string
  courseTitle: string
  courseIndex: number
  courseLessons: Lesson[]
  currentLessonIndex: number
  currentLessonSlug: string
  challengeOptions: Array<{ slug: string; title: string }>
  activeChallengeSlug: string | null
  previousChallengeSlug: string | null
  nextChallengeSlug: string | null
}

/**
 * Displays learner navigation controls for course progress, chapter selection,
 * and course selection without leaking routing details into the page.
 */
export function CourseProgressStrip({
  courseSlug,
  courseTitle,
  courseIndex,
  courseLessons,
  currentLessonIndex,
  currentLessonSlug,
  challengeOptions,
  activeChallengeSlug,
  previousChallengeSlug,
  nextChallengeSlug
}: CourseProgressStripProps) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(160deg,rgba(16,20,30,0.98),rgba(23,28,40,0.95))] px-4 py-3 text-white shadow-[0_18px_45px_rgba(11,15,24,0.35)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase leading-[1.35] tracking-[0.24em] text-white/45">Course progress</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {courseLessons.map((lesson, index) => {
              const isCurrent = index === currentLessonIndex
              const isCompleted = index < currentLessonIndex

              return (
                <Link
                  key={lesson.id}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  aria-label={`Open chapter ${index + 1}: ${lesson.title}`}
                  className={`inline-flex rounded-full border transition ${
                    isCurrent
                      ? "h-3 w-3 border-[var(--accent-soft)] bg-[var(--accent)] shadow-[0_0_0_3px_rgba(201,111,54,0.16)]"
                      : isCompleted
                        ? "h-2.5 w-2.5 border-white/30 bg-white/85 hover:bg-white"
                        : "h-2.5 w-2.5 border-white/25 bg-white/8 hover:bg-white/24"
                  }`}
                />
              )
            })}
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(220px,0.95fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto] xl:items-center">
          <div className="rounded-xl border border-white/10 bg-white/6 px-3.5 py-2.5">
            <p className="text-[10px] uppercase leading-[1.35] tracking-[0.24em] text-white/45">Course</p>
            <p className="mt-1 text-sm font-semibold text-white">{`L${courseIndex}: ${courseTitle}`}</p>
          </div>

          <select
            value={currentLessonSlug}
            aria-label="Current chapter"
            onChange={(event) => router.push(`/learn/${courseSlug}/${event.target.value}`)}
            className="h-10 rounded-xl border border-white/10 bg-white/6 px-3.5 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
          >
            {courseLessons.map((lesson, index) => (
              <option key={lesson.id} value={lesson.slug} className="text-[var(--ink-strong)]">
                {`CH${index + 1}: ${lesson.title}`}
              </option>
            ))}
          </select>

          <select
            value={activeChallengeSlug ?? ""}
            aria-label="Current assignment"
            onChange={(event) => router.push(`/learn/${courseSlug}/${currentLessonSlug}?assignment=${event.target.value}`)}
            className="h-10 rounded-xl border border-white/10 bg-white/6 px-3.5 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
            disabled={!challengeOptions.length}
          >
            {challengeOptions.map((option, index) => (
              <option key={option.slug} value={option.slug} className="text-[var(--ink-strong)]">
                {`A${index + 1}: ${option.title}`}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Link
              href={previousChallengeSlug ? `/learn/${courseSlug}/${currentLessonSlug}?assignment=${previousChallengeSlug}` : "#"}
              aria-disabled={!previousChallengeSlug}
              className={`inline-flex items-center justify-center rounded-full border transition ${
                previousChallengeSlug
                  ? "h-10 w-10 border-white/10 bg-white/8 text-white hover:bg-white/16"
                  : "pointer-events-none h-10 w-10 border-white/5 bg-white/5 text-white/30"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={nextChallengeSlug ? `/learn/${courseSlug}/${currentLessonSlug}?assignment=${nextChallengeSlug}` : "#"}
              aria-disabled={!nextChallengeSlug}
              className={`inline-flex items-center justify-center rounded-full border transition ${
                nextChallengeSlug
                  ? "h-10 w-10 border-[var(--accent-soft)] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(201,111,54,0.24)] hover:brightness-105"
                  : "pointer-events-none h-10 w-10 border-white/5 bg-white/5 text-white/30"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
