"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

type LessonOption = {
  value: string
  label: string
  href: string
}

type ChallengeOption = {
  slug: string
  title: string
  href: string
}

type PracticeSessionStripState = {
  modeLabel: string
  queuePosition: number
  queueLength: number
}

type CourseProgressStripProps = {
  courseTitle: string
  lessonOptions: LessonOption[]
  currentLessonValue: string
  challengeOptions: ChallengeOption[]
  activeChallengeSlug: string | null
  previousChallengeHref: string | null
  nextChallengeHref: string | null
  completedChallengeSlugs: string[]
  practiceSession?: PracticeSessionStripState | null
}

/**
 * Displays learner navigation controls for course progress, chapter selection,
 * and course selection without leaking routing details into the page.
 */
export function CourseProgressStrip({
  courseTitle,
  lessonOptions,
  currentLessonValue,
  challengeOptions,
  activeChallengeSlug,
  previousChallengeHref,
  nextChallengeHref,
  completedChallengeSlugs,
  practiceSession = null
}: CourseProgressStripProps) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(16,20,30,0.98),rgba(23,28,40,0.95))] px-3 py-2.5 text-white shadow-[0_16px_34px_rgba(11,15,24,0.32)]">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          {practiceSession ? (
            <>
              <p className="text-[9px] uppercase leading-[1.3] tracking-[0.24em] text-white/45">Session queue</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/78">
                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                  {practiceSession.modeLabel}
                </span>
                <span>{`${practiceSession.queuePosition} of ${practiceSession.queueLength}`}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Assignment navigation">
              {challengeOptions.map((challenge, index) => {
                const isCurrent = challenge.slug === activeChallengeSlug
                const isCompleted = completedChallengeSlugs.includes(challenge.slug)
                const className = isCurrent
                  ? isCompleted
                    ? "h-2.5 w-2.5 border-[var(--accent-soft)] bg-[var(--accent)] shadow-[0_0_0_2px_rgba(201,111,54,0.22)]"
                    : "h-2.5 w-2.5 border-white/45 bg-transparent shadow-[0_0_0_2px_rgba(255,255,255,0.08)]"
                  : isCompleted
                    ? "h-2 w-2 border-[var(--accent-soft)] bg-[var(--accent)]/82 hover:bg-[var(--accent)]"
                    : "h-2 w-2 border-white/25 bg-white/8 hover:bg-white/24"

                return (
                  <Link
                    key={challenge.slug}
                    href={challenge.href}
                    aria-label={`Open assignment ${index + 1}: ${challenge.title}`}
                    className={`inline-flex rounded-full border transition ${className}`}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(210px,0.95fr)_minmax(210px,1fr)_minmax(210px,1fr)_auto] xl:items-center">
          <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">
            <p className="text-[9px] uppercase leading-[1.3] tracking-[0.24em] text-white/45">Course</p>
            <p className="mt-1 text-sm font-semibold text-white">{courseTitle}</p>
          </div>

          <select
            value={currentLessonValue}
            aria-label="Current chapter"
            onChange={(event) => {
              const nextLesson = lessonOptions.find((option) => option.value === event.target.value)
              if (nextLesson) {
                router.push(nextLesson.href)
              }
            }}
            className="h-9 rounded-xl border border-white/10 bg-white/6 px-3 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
          >
            {lessonOptions.map((lesson) => (
              <option key={lesson.value} value={lesson.value} className="text-[var(--ink-strong)]">
                {lesson.label}
              </option>
            ))}
          </select>

          <select
            value={activeChallengeSlug ?? ""}
            aria-label="Current assignment"
            onChange={(event) => {
              const nextChallenge = challengeOptions.find((option) => option.slug === event.target.value)
              if (nextChallenge) {
                router.push(nextChallenge.href)
              }
            }}
            className="h-9 rounded-xl border border-white/10 bg-white/6 px-3 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-[var(--accent)]"
            disabled={!challengeOptions.length}
          >
            {challengeOptions.map((option, index) => (
              <option key={option.slug} value={option.slug} className="text-[var(--ink-strong)]">
                {practiceSession ? `${index + 1}. ${option.title}` : `A${index + 1}: ${option.title}`}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Link
              href={previousChallengeHref ?? "#"}
              aria-disabled={!previousChallengeHref}
              className={`inline-flex items-center justify-center rounded-full border transition ${
                previousChallengeHref
                  ? "h-9 w-9 border-white/12 bg-white/8 text-white hover:border-[var(--accent-soft)] hover:bg-[color:rgb(201_111_54/0.16)]"
                  : "pointer-events-none h-9 w-9 border-white/6 bg-[rgba(255,255,255,0.04)] text-white/25"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={nextChallengeHref ?? "#"}
              aria-disabled={!nextChallengeHref}
              className={`inline-flex items-center justify-center rounded-full border transition ${
                nextChallengeHref
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
