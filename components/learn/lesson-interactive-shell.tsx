"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ChallengeWorkbench } from "@/components/code/challenge-workbench"
import { CourseProgressStrip } from "@/components/learn/course-progress-strip"
import type { Challenge } from "@/lib/types"

type LessonNavigationOption = {
  value: string
  label: string
  href: string
}

type ChallengeNavigationOption = {
  slug: string
  title: string
  href: string
}

type PracticeSessionStripState = {
  modeLabel: string
  queuePosition: number
  queueLength: number
}

type LessonInteractiveShellProps = {
  courseSlug: string
  courseTitle: string
  lessonOptions: LessonNavigationOption[]
  currentLessonValue: string
  lessonSlug: string
  challengeOptions: ChallengeNavigationOption[]
  activeChallengeSlug: string | null
  previousChallengeHref: string | null
  nextChallengeHref: string | null
  initialCompletedChallengeSlugs: string[]
  activeChallenge: Challenge | null
  isAuthenticated: boolean
  practiceSession?: PracticeSessionStripState | null
  children: ReactNode
}

function getSerializedCompletedChallengeSlugs(challengeSlugs: string[]) {
  return [...new Set(challengeSlugs)].sort().join("|")
}

type CompletionOverrides = Record<string, boolean>

/**
 * Keeps learner progress feedback responsive on the client while the server
 * remains the source of truth for lesson content and routing.
 */
export function LessonInteractiveShell({
  courseSlug,
  courseTitle,
  lessonOptions,
  currentLessonValue,
  lessonSlug,
  challengeOptions,
  activeChallengeSlug,
  previousChallengeHref,
  nextChallengeHref,
  initialCompletedChallengeSlugs,
  activeChallenge,
  isAuthenticated,
  practiceSession = null,
  children
}: LessonInteractiveShellProps) {
  const [completionOverrides, setCompletionOverrides] = useState<CompletionOverrides>({})
  const serializedCompletedChallengeSlugs = useMemo(
    () => getSerializedCompletedChallengeSlugs(initialCompletedChallengeSlugs),
    [initialCompletedChallengeSlugs]
  )
  const completedChallengeSlugs = useMemo(() => {
    const completed = new Set(initialCompletedChallengeSlugs)

    Object.entries(completionOverrides).forEach(([challengeSlug, isCompleted]) => {
      if (isCompleted) {
        completed.add(challengeSlug)
        return
      }

      completed.delete(challengeSlug)
    })

    return [...completed]
  }, [completionOverrides, initialCompletedChallengeSlugs])

  useEffect(() => {
    setCompletionOverrides((current) => {
      const serverCompleted = new Set(initialCompletedChallengeSlugs)
      const nextEntries = Object.entries(current).filter(
        ([challengeSlug, isCompleted]) => serverCompleted.has(challengeSlug) !== isCompleted
      )

      if (nextEntries.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(nextEntries)
    })
  }, [initialCompletedChallengeSlugs, serializedCompletedChallengeSlugs])

  const handleCompletionChange = (challengeSlug: string, completed: boolean) => {
    setCompletionOverrides((current) => {
      const next = {
        ...current,
        [challengeSlug]: completed
      }

      const serverCompleted = initialCompletedChallengeSlugs.includes(challengeSlug)
      if (serverCompleted === completed) {
        delete next[challengeSlug]
      }

      return next
    })
  }

  return (
    <>
      <CourseProgressStrip
        courseTitle={courseTitle}
        lessonOptions={lessonOptions}
        currentLessonValue={currentLessonValue}
        challengeOptions={challengeOptions}
        activeChallengeSlug={activeChallengeSlug}
        previousChallengeHref={previousChallengeHref}
        nextChallengeHref={nextChallengeHref}
        completedChallengeSlugs={completedChallengeSlugs}
        practiceSession={practiceSession}
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#131824,#101520)] text-white shadow-[0_28px_80px_rgba(11,15,24,0.32)]">
        <div className="grid min-h-[calc(100vh-11rem)] xl:grid-cols-[minmax(430px,0.92fr)_minmax(660px,1.08fr)]">
          <aside className="border-b border-white/10 px-6 py-6 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
            {children}
          </aside>

          <div className="min-h-0 p-4 sm:p-5">
            {activeChallenge ? (
              <ChallengeWorkbench
                challenge={activeChallenge}
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                isAuthenticated={isAuthenticated}
                isCompleted={completedChallengeSlugs.includes(activeChallenge.slug)}
                onCompletionChange={handleCompletionChange}
              />
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
