import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { notFound } from "next/navigation"

import { LessonInteractiveShell } from "@/components/learn/lesson-interactive-shell"
import { LessonSideTools } from "@/components/learn/lesson-side-tools"
import { Badge } from "@/components/ui/badge"
import { getEffectiveAssignmentReading, getEffectiveAssignmentReadingLabel } from "@/lib/content/reading"
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
    reference?: string
    search?: string
  }>
}

export const dynamic = "force-dynamic"

function getAssignmentTitle(challenge: Challenge, index: number) {
  const normalizedTitle = challenge.title.replace(/^assignment[:\s-]*/i, "").trim()
  const safeTitle = normalizedTitle || `Assignment ${index + 1}`
  return safeTitle.length > 42 ? `${safeTitle.slice(0, 39).trimEnd()}...` : safeTitle
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
  const { assignment, reference, search } = await searchParams
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
  const currentHref = `/learn/${data.course.slug}/${data.lesson.slug}${activeChallenge ? `?assignment=${activeChallenge.slug}` : ""}`
  const selectedReferenceEntry =
    data.courseReadingEntries.find((entry) => entry.id === reference) ?? null
  const readingSource = getEffectiveAssignmentReading({
    lessonBodyMdx: data.lesson.bodyMdx,
    challengeReadingMdx: activeChallenge?.readingMdx,
    challengePromptMdx: activeChallenge?.promptMdx
  })
  const readingSourceLabel = getEffectiveAssignmentReadingLabel({
    lessonBodyMdx: data.lesson.bodyMdx,
    challengeReadingMdx: activeChallenge?.readingMdx,
    challengePromptMdx: activeChallenge?.promptMdx
  })

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-10 sm:px-6 xl:px-10">
      <LessonInteractiveShell
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
        initialCompletedChallengeSlugs={completedChallengeSlugs}
        activeChallenge={activeChallenge}
        isAuthenticated={Boolean(user)}
      >
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
            <div className="mb-4">
              <Badge className="bg-white/10 text-white">{readingSourceLabel}</Badge>
            </div>
            <MdxRenderer source={readingSource} tone="dark" />
          </LessonPanelSection>

          {activeChallenge ? (
            <LessonPanelSection
              title={data.challenges.length > 1 ? `Assignment ${safeActiveChallengeIndex + 1}` : "Assignment"}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge className="bg-white/10 text-white">
                  {activeChallenge.kind === "multiple_choice" ? "multiple choice" : activeChallenge.language}
                </Badge>
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

          {selectedReferenceEntry ? (
            <LessonPanelSection title={selectedReferenceEntry.title} defaultOpen>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-white/10 text-white">{selectedReferenceEntry.sectionLabel}</Badge>
                  <Badge className="bg-white/8 text-white ring-1 ring-white/10">Reference reading</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={selectedReferenceEntry.href}
                    className="text-sm text-white/65 underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    Open source lesson
                  </Link>
                  <Link
                    href={`${currentHref}${search?.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`}
                    className="text-sm text-white/65 underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    Close
                  </Link>
                </div>
              </div>
              <MdxRenderer source={selectedReferenceEntry.bodyMdx} tone="dark" />
            </LessonPanelSection>
          ) : null}

          <LessonSideTools
            currentHref={currentHref}
            entries={data.courseReadingEntries}
            initialQuery={search ?? ""}
            referenceEntryId={selectedReferenceEntry?.id ?? null}
          />
        </div>
      </LessonInteractiveShell>
    </div>
  )
}
