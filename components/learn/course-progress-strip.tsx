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
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(160deg,rgba(25,31,45,0.97),rgba(33,39,57,0.94))] px-5 py-5 text-white shadow-[0_24px_60px_rgba(25,31,45,0.18)] sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase leading-[1.35] tracking-[0.22em] text-white/50">Course progress</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {courseLessons.map((lesson, index) => {
              const isCurrent = index === currentLessonIndex
              const isCompleted = index < currentLessonIndex

              return (
                <Link
                  key={lesson.id}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  aria-label={`Open chapter ${index + 1}: ${lesson.title}`}
                  className={`inline-flex h-4 w-4 rounded-full border transition ${
                    isCurrent
                      ? "border-[var(--accent-soft)] bg-[var(--accent)] shadow-[0_0_0_4px_rgba(201,111,54,0.16)]"
                      : isCompleted
                        ? "border-white/30 bg-white/75 hover:bg-white"
                        : "border-white/20 bg-white/10 hover:bg-white/24"
                  }`}
                />
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(240px,0.8fr)_minmax(220px,1fr)_minmax(260px,1fr)_auto] xl:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-xs uppercase leading-[1.35] tracking-[0.22em] text-white/45">Learning path</p>
            <p className="mt-2 text-sm font-semibold text-white">{`L${courseIndex}: ${courseTitle}`}</p>
          </div>

          <select
            value={currentLessonSlug}
            aria-label="Current chapter"
            onChange={(event) => router.push(`/learn/${courseSlug}/${event.target.value}`)}
            className="h-12 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-semibold text-white outline-none transition hover:bg-white/12 focus:border-[var(--accent)]"
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
            className="h-12 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-semibold text-white outline-none transition hover:bg-white/12 focus:border-[var(--accent)]"
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
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                previousChallengeSlug
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/18"
                  : "pointer-events-none border-white/5 bg-white/5 text-white/30"
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Link
              href={nextChallengeSlug ? `/learn/${courseSlug}/${currentLessonSlug}?assignment=${nextChallengeSlug}` : "#"}
              aria-disabled={!nextChallengeSlug}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                nextChallengeSlug
                  ? "border-[var(--accent-soft)] bg-[var(--accent)] text-white shadow-[0_12px_28px_rgba(201,111,54,0.26)] hover:brightness-105"
                  : "pointer-events-none border-white/5 bg-white/5 text-white/30"
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
