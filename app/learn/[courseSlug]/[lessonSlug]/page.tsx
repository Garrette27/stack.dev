import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { notFound } from "next/navigation"

import { ChallengeWorkbench } from "@/components/code/challenge-workbench"
import { CourseProgressStrip } from "@/components/learn/course-progress-strip"
import { LessonSideTools } from "@/components/learn/lesson-side-tools"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser, getLessonPageData } from "@/lib/data"
import { MdxRenderer } from "@/lib/mdx"
import { getCompletedChallengeSlugs } from "@/lib/progress"
import type { Challenge } from "@/lib/types"

type LessonPageProps = {
  params: Promise<{
    courseSlug: string
    lessonSlug: string
  }>
  searchParams: Promise<{
    assignment?: string
  }>
}

function getAssignmentTitle(challenge: Challenge, index: number) {
  const normalizedTitle = challenge.title.replace(/^assignment[:\s-]*/i, "").trim()
  const safeTitle = normalizedTitle || `Assignment ${index + 1}`
  return safeTitle.length > 42 ? `${safeTitle.slice(0, 39).trimEnd()}...` : safeTitle
}

/**
 * Keeps the reading panel chapter-first while still giving each assignment a
 * distinct fallback when no dedicated assignment reading has been authored yet.
 */
function getActiveReadingSource(lessonBodyMdx: string, activeChallenge: Challenge | null) {
  const challengeReading = activeChallenge?.readingMdx.trim()
  const assignmentPrompt = activeChallenge?.promptMdx.trim()

  if (challengeReading) {
    return challengeReading
  }

  if (!assignmentPrompt) {
    return lessonBodyMdx
  }

  if (!lessonBodyMdx.trim()) {
    return assignmentPrompt
  }

  return `${lessonBodyMdx.trim()}

## Assignment focus

${assignmentPrompt}`
}

function LessonPanelSection({
  title,
  defaultOpen = true,
  children
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5"
    >
      <summary className="flex list-none items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-serif text-3xl text-white">{title}</span>
        <ChevronDown className="h-5 w-5 text-white/55 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10 px-5 py-5">
        {children}
      </div>
    </details>
  )
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params
  const { assignment } = await searchParams
  const [data, user] = await Promise.all([getLessonPageData(courseSlug, lessonSlug), getCurrentUser()])

  if (!data) {
    notFound()
  }

  const activeChallengeIndex = data.challenges.findIndex((challenge) => challenge.slug === assignment)
  const safeActiveChallengeIndex = activeChallengeIndex >= 0 ? activeChallengeIndex : 0
  const activeChallenge = data.challenges[safeActiveChallengeIndex] ?? null
  const previousChallengeSlug = data.challenges[safeActiveChallengeIndex - 1]?.slug ?? null
  const nextChallengeSlug = data.challenges[safeActiveChallengeIndex + 1]?.slug ?? null
  const completedChallengeSlugs = await getCompletedChallengeSlugs(data.challenges)
  const challengeOptions = data.challenges.map((challenge, index) => ({
    slug: challenge.slug,
    title: getAssignmentTitle(challenge, index)
  }))
  const readingSource = getActiveReadingSource(data.lesson.bodyMdx, activeChallenge)

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-10 sm:px-6 xl:px-10">
      <CourseProgressStrip
        courseSlug={data.course.slug}
        courseTitle={data.course.title}
        courseIndex={data.courseIndex}
        courseLessons={data.courseLessons}
        currentLessonIndex={data.currentLessonIndex}
        currentLessonSlug={data.lesson.slug}
        challengeOptions={challengeOptions}
        activeChallengeSlug={activeChallenge?.slug ?? null}
        previousChallengeSlug={previousChallengeSlug}
        nextChallengeSlug={nextChallengeSlug}
        completedChallengeSlugs={completedChallengeSlugs}
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#131824,#101520)] text-white shadow-[0_28px_80px_rgba(11,15,24,0.32)]">
        <div className="grid min-h-[calc(100vh-11rem)] xl:grid-cols-[minmax(430px,0.92fr)_minmax(660px,1.08fr)]">
          <aside className="border-b border-white/10 px-6 py-6 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
            <div className="space-y-6">
              <Link href={`/learn/${data.course.slug}`} className="inline-flex items-center gap-2 text-sm text-white/60">
                <ArrowLeft className="h-4 w-4" />
                Back to course
              </Link>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{`CH${data.currentLessonIndex + 1}`}</Badge>
                  <Badge className="bg-white/8 text-white ring-1 ring-white/10">{`L${data.courseIndex}: ${data.course.title}`}</Badge>
                </div>
                <div className="space-y-4">
                  <h1 className="font-serif text-5xl tracking-tight text-white sm:text-6xl">{data.lesson.title}</h1>
                  <p className="max-w-3xl text-lg leading-8 text-slate-300">{data.lesson.summary}</p>
                </div>
              </div>

              <LessonPanelSection title="Reading">
                <MdxRenderer source={readingSource} tone="dark" />
              </LessonPanelSection>

              {activeChallenge ? (
                <LessonPanelSection
                  title={data.challenges.length > 1 ? `Assignment ${safeActiveChallengeIndex + 1}` : "Assignment"}
                >
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Badge className="bg-white/10 text-white">{activeChallenge.language}</Badge>
                    {data.challenges.length > 1 ? (
                      <span className="text-xs uppercase tracking-[0.22em] text-white/45">
                        {`${safeActiveChallengeIndex + 1} of ${data.challenges.length}`}
                      </span>
                    ) : null}
                  </div>
                  <MdxRenderer source={activeChallenge.promptMdx} tone="dark" />
                </LessonPanelSection>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/4 px-5 py-4 text-sm text-white/60">
                  Practice for this chapter will appear here when it is ready.
                </div>
              )}

              <LessonSideTools
                currentHref={`/learn/${data.course.slug}/${data.lesson.slug}${activeChallenge ? `?assignment=${activeChallenge.slug}` : ""}`}
                entries={data.courseReadingEntries}
              />
            </div>
          </aside>

          <div className="min-h-0 p-4 sm:p-5">
            {activeChallenge ? (
              <ChallengeWorkbench
                challenge={activeChallenge}
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                isAuthenticated={Boolean(user)}
                isCompleted={completedChallengeSlugs.includes(activeChallenge.slug)}
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
