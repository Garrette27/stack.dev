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
  completedChallengeSlugs: string[]
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
  nextChallengeSlug,
  completedChallengeSlugs
}: CourseProgressStripProps) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(16,20,30,0.98),rgba(23,28,40,0.95))] px-3 py-2.5 text-white shadow-[0_16px_34px_rgba(11,15,24,0.32)]">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] uppercase leading-[1.3] tracking-[0.24em] text-white/45">Assignment progress</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {challengeOptions.map((challenge, index) => {
              const isCurrent = challenge.slug === activeChallengeSlug
              const isCompleted = completedChallengeSlugs.includes(challenge.slug)
              const className = isCurrent
                ? isCompleted
                  ? "h-2.5 w-2.5 border-[var(--accent-soft)] bg-[var(--accent)] shadow-[0_0_0_2px_rgba(201,111,54,0.22)]"
                  : "h-2.5 w-2.5 border-[var(--accent-soft)] bg-transparent shadow-[0_0_0_2px_rgba(201,111,54,0.16)]"
                : isCompleted
                  ? "h-2 w-2 border-[var(--accent-soft)] bg-[var(--accent)]/82 hover:bg-[var(--accent)]"
                  : "h-2 w-2 border-white/25 bg-white/8 hover:bg-white/24"

              return (
                <Link
                  key={challenge.slug}
                  href={`/learn/${courseSlug}/${currentLessonSlug}?assignment=${challenge.slug}`}
                  aria-label={`Open assignment ${index + 1}: ${challenge.title}`}
                  className={`inline-flex rounded-full border transition ${className}`}
                />
              )
            })}
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(210px,0.95fr)_minmax(210px,1fr)_minmax(210px,1fr)_auto] xl:items-center">
          <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">
            <p className="text-[9px] uppercase leading-[1.3] tracking-[0.24em] text-white/45">Course</p>
            <p className="mt-1 text-sm font-semibold text-white">{`L${courseIndex}: ${courseTitle}`}</p>
          </div>

          <select
            value={currentLessonSlug}
            aria-label="Current chapter"
            onChange={(event) => router.push(`/learn/${courseSlug}/${event.target.value}`)}
            className="h-9 rounded-xl border border-white/10 bg-white/6 px-3 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
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
            className="h-9 rounded-xl border border-white/10 bg-white/6 px-3 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
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
                  ? "h-9 w-9 border-white/12 bg-white/8 text-white hover:border-[var(--accent-soft)] hover:bg-[color:rgb(201_111_54/0.16)]"
                  : "pointer-events-none h-9 w-9 border-white/6 bg-[rgba(255,255,255,0.04)] text-white/25"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={nextChallengeSlug ? `/learn/${courseSlug}/${currentLessonSlug}?assignment=${nextChallengeSlug}` : "#"}
              aria-disabled={!nextChallengeSlug}
              className={`inline-flex items-center justify-center rounded-full border transition ${
                nextChallengeSlug
                  ? "h-9 w-9 border-white/12 bg-white/8 text-white hover:border-[var(--accent-soft)] hover:bg-[color:rgb(201_111_54/0.16)]"
                  : "pointer-events-none h-9 w-9 border-white/6 bg-[rgba(255,255,255,0.04)] text-white/25"
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
