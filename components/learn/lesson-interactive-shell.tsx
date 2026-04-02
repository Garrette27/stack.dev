"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ChallengeWorkbench } from "@/components/code/challenge-workbench"
import { CourseProgressStrip } from "@/components/learn/course-progress-strip"
import type { Challenge, Lesson } from "@/lib/types"

type LessonInteractiveShellProps = {
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
  initialCompletedChallengeSlugs: string[]
  activeChallenge: Challenge | null
  isAuthenticated: boolean
  children: ReactNode
}

function getSerializedCompletedChallengeSlugs(challengeSlugs: string[]) {
  return [...new Set(challengeSlugs)].sort().join("|")
}

/**
 * Keeps learner progress feedback responsive on the client while the server
 * remains the source of truth for lesson content and routing.
 */
export function LessonInteractiveShell({
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
  initialCompletedChallengeSlugs,
  activeChallenge,
  isAuthenticated,
  children
}: LessonInteractiveShellProps) {
  const [completedChallengeSlugs, setCompletedChallengeSlugs] = useState(initialCompletedChallengeSlugs)
  const serializedCompletedChallengeSlugs = useMemo(
    () => getSerializedCompletedChallengeSlugs(initialCompletedChallengeSlugs),
    [initialCompletedChallengeSlugs]
  )

  useEffect(() => {
    setCompletedChallengeSlugs(initialCompletedChallengeSlugs)
  }, [initialCompletedChallengeSlugs, serializedCompletedChallengeSlugs])

  const handleCompletionChange = (challengeSlug: string, completed: boolean) => {
    setCompletedChallengeSlugs((current) => {
      const withoutChallenge = current.filter((slug) => slug !== challengeSlug)
      return completed ? [...withoutChallenge, challengeSlug] : withoutChallenge
    })
  }

  return (
    <>
      <CourseProgressStrip
        courseSlug={courseSlug}
        courseTitle={courseTitle}
        courseIndex={courseIndex}
        courseLessons={courseLessons}
        currentLessonIndex={currentLessonIndex}
        currentLessonSlug={currentLessonSlug}
        challengeOptions={challengeOptions}
        activeChallengeSlug={activeChallengeSlug}
        previousChallengeSlug={previousChallengeSlug}
        nextChallengeSlug={nextChallengeSlug}
        completedChallengeSlugs={completedChallengeSlugs}
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
                lessonSlug={currentLessonSlug}
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
