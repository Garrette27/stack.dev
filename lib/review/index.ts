import "server-only"

import { hasSupabaseEnv } from "@/lib/env"
import { getCurrentUser } from "@/lib/auth"
import { getContentSnapshot } from "@/lib/content"
import { sortLessons } from "@/lib/content/shared"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { Challenge, Course, Lesson } from "@/lib/types"

import {
  buildPracticeQueue,
  getReviewBucket,
  scheduleNextChallengeReview,
  type ChallengeReviewState,
  type PracticeQueueItem,
  type ReviewBucket,
  type ReviewResult
} from "./scheduler"

export type PracticeMode = "smart_shuffle" | "due_reviews" | "missed_again"

export type PracticeSummary = {
  learningCount: number
  unseenCount: number
  dueCount: number
  stableCount: number
  totalCount: number
}

export type PracticeQueueEntry = {
  challengeId: string
  challengeSlug: string
  challengeTitle: string
  lessonSlug: string
  lessonTitle: string
  lessonIndex: number
  challengeIndex: number
  bucket: ReviewBucket
  dueAt: string | null
  href: string
}

export type CoursePracticePageData = {
  course: Course
  courseIndex: number
  lessons: Lesson[]
  summary: PracticeSummary
  mode: PracticeMode
  modeLabel: string
  seed: string
  startHref: string | null
  queuePreview: PracticeQueueEntry[]
}

export type PracticeSessionData = {
  mode: PracticeMode
  modeLabel: string
  seed: string
  queueEntries: PracticeQueueEntry[]
  activeIndex: number
  previousHref: string | null
  nextHref: string | null
  challengeOptions: Array<{ slug: string; title: string; href: string }>
}

type ServerSupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerClient>>>
type ReviewStateStoreClient = Pick<ServerSupabaseClient, "from">

type CoursePracticeChallenge = {
  challenge: Challenge
  lesson: Lesson
  lessonIndex: number
  challengeIndex: number
}

function createEmptyReviewState(challengeId: string): ChallengeReviewState {
  return {
    challengeId,
    lastResult: "unseen",
    successStreak: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    lastReviewedAt: null,
    nextReviewAt: null
  }
}

function isMissingReviewStateTable(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("challenge_review_state") === true
  )
}

function normalizePracticeMode(value?: string | null): PracticeMode {
  if (value === "due_reviews" || value === "missed_again") {
    return value
  }

  return "smart_shuffle"
}

function getPracticeModeLabel(mode: PracticeMode) {
  if (mode === "due_reviews") {
    return "Due reviews"
  }

  if (mode === "missed_again") {
    return "Missed again"
  }

  return "Smart shuffle"
}

function isReviewDue(state: ChallengeReviewState | null, now: Date) {
  if (!state || state.lastResult === "unseen" || !state.nextReviewAt) {
    return false
  }

  return new Date(state.nextReviewAt).getTime() <= now.getTime()
}

function buildPracticeSeed(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"

  return `${year}-${month}-${day}`
}

function getChallengeDisplayTitle(challenge: Challenge, lessonIndex: number, challengeIndex: number) {
  const normalizedTitle = challenge.title.replace(/^assignment[:\s-]*/i, "").trim()
  const safeTitle = normalizedTitle || `Assignment ${challengeIndex + 1}`
  const shortTitle = safeTitle.length > 48 ? `${safeTitle.slice(0, 45).trimEnd()}...` : safeTitle
  return `CH${lessonIndex + 1} · A${challengeIndex + 1}: ${shortTitle}`
}

function buildPracticeAssignmentHref(
  courseSlug: string,
  lessonSlug: string,
  challengeSlug: string,
  mode: PracticeMode,
  seed: string
) {
  const params = new URLSearchParams({
    assignment: challengeSlug,
    practiceMode: mode,
    practiceSeed: seed
  })

  return `/learn/${courseSlug}/${lessonSlug}?${params.toString()}`
}

function getCoursePracticeChallenges(course: Course, lessons: Lesson[], challenges: Challenge[]) {
  return lessons.flatMap((lesson, lessonIndex) =>
    lesson.challengeIds.flatMap((challengeId, challengeIndex) => {
      const challenge = challenges.find((item) => item.id === challengeId && item.published) ?? null

      if (!challenge) {
        return []
      }

      return [
        {
          challenge,
          lesson,
          lessonIndex,
          challengeIndex
        } satisfies CoursePracticeChallenge
      ]
    })
  )
}

function mapReviewState(row: Record<string, unknown>): ChallengeReviewState {
  return {
    challengeId: String(row.challenge_id),
    lastResult: String(row.last_result ?? "unseen") as ChallengeReviewState["lastResult"],
    successStreak: Number(row.success_streak ?? 0),
    successfulAttempts: Number(row.successful_attempts ?? 0),
    failedAttempts: Number(row.failed_attempts ?? 0),
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null
  }
}

async function getChallengeReviewStatesForCurrentUser(challenges: Challenge[]): Promise<ChallengeReviewState[]> {
  if (!challenges.length || !hasSupabaseEnv()) {
    return []
  }

  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return []
  }

  const result = await supabase
    .from("challenge_review_state")
    .select("challenge_id,last_result,success_streak,successful_attempts,failed_attempts,last_reviewed_at,next_review_at")
    .eq("user_id", user.id)
    .in("challenge_id", challenges.map((challenge) => challenge.id))

  if (result.error) {
    if (isMissingReviewStateTable({ code: result.error.code, message: result.error.message })) {
      return []
    }

    throw new Error(result.error.message)
  }

  return (result.data ?? []).map((row) => mapReviewState(row as Record<string, unknown>))
}

function filterPracticeQueueItems(
  queue: PracticeQueueItem[],
  stateByChallengeId: Map<string, ChallengeReviewState>,
  mode: PracticeMode,
  now: Date
) {
  if (mode === "due_reviews") {
    return queue.filter((item) => {
      const state = stateByChallengeId.get(item.challengeId) ?? null
      return Boolean(state?.lastResult === "passed" && isReviewDue(state, now))
    })
  }

  if (mode === "missed_again") {
    return queue.filter((item) => {
      const state = stateByChallengeId.get(item.challengeId) ?? null
      return state?.lastResult === "failed"
    })
  }

  return queue
}

function buildPracticeSummary(
  courseChallenges: CoursePracticeChallenge[],
  states: ChallengeReviewState[],
  now: Date
): PracticeSummary {
  const stateByChallengeId = new Map(states.map((state) => [state.challengeId, state]))
  let learningCount = 0
  let unseenCount = 0
  let dueCount = 0
  let stableCount = 0

  courseChallenges.forEach(({ challenge }) => {
    const state = stateByChallengeId.get(challenge.id) ?? null
    const bucket = getReviewBucket(state, now)

    if (bucket === "learning") {
      learningCount += 1
      return
    }

    if (bucket === "new") {
      unseenCount += 1
      return
    }

    if (isReviewDue(state, now)) {
      dueCount += 1
      return
    }

    stableCount += 1
  })

  return {
    learningCount,
    unseenCount,
    dueCount,
    stableCount,
    totalCount: courseChallenges.length
  }
}

async function loadCoursePracticeModel(courseSlug: string, modeValue?: string | null, seedValue?: string | null) {
  const snapshot = await getContentSnapshot()
  const course = snapshot.courses.find((item) => item.slug === courseSlug)

  if (!course) {
    return null
  }

  const lessons = sortLessons(snapshot.lessons.filter((lesson) => lesson.courseId === course.id && lesson.published))
  const courseChallenges = getCoursePracticeChallenges(course, lessons, snapshot.challenges)
  const reviewStates = await getChallengeReviewStatesForCurrentUser(courseChallenges.map((item) => item.challenge))
  const now = new Date()
  const mode = normalizePracticeMode(modeValue)
  const seed = seedValue?.trim() || buildPracticeSeed(now)
  const queueItems = filterPracticeQueueItems(
    buildPracticeQueue(
      courseChallenges.map((item) => item.challenge.id),
      reviewStates,
      {
        now,
        seed
      }
    ),
    new Map(reviewStates.map((state) => [state.challengeId, state])),
    mode,
    now
  )
  const challengeById = new Map(courseChallenges.map((item) => [item.challenge.id, item]))
  const queueEntries = queueItems.flatMap((item) => {
    const source = challengeById.get(item.challengeId)

    if (!source) {
      return []
    }

    return [
      {
        challengeId: source.challenge.id,
        challengeSlug: source.challenge.slug,
        challengeTitle: getChallengeDisplayTitle(source.challenge, source.lessonIndex, source.challengeIndex),
        lessonSlug: source.lesson.slug,
        lessonTitle: source.lesson.title,
        lessonIndex: source.lessonIndex,
        challengeIndex: source.challengeIndex,
        bucket: item.bucket,
        dueAt: item.dueAt,
        href: buildPracticeAssignmentHref(course.slug, source.lesson.slug, source.challenge.slug, mode, seed)
      } satisfies PracticeQueueEntry
    ]
  })

  return {
    course,
    courseIndex: snapshot.courses.findIndex((item) => item.id === course.id) + 1,
    lessons,
    courseChallenges,
    queueEntries,
    summary: buildPracticeSummary(courseChallenges, reviewStates, now),
    mode,
    modeLabel: getPracticeModeLabel(mode),
    seed
  }
}

/**
 * Builds the course-level practice hub behind one review-domain API so pages do
 * not need to know about review storage, bucket rules, or queue generation.
 */
export async function getCoursePracticePageData(
  courseSlug: string,
  options?: {
    mode?: string | null
    seed?: string | null
  }
): Promise<CoursePracticePageData | null> {
  const model = await loadCoursePracticeModel(courseSlug, options?.mode, options?.seed)

  if (!model) {
    return null
  }

  return {
    course: model.course,
    courseIndex: model.courseIndex,
    lessons: model.lessons,
    summary: model.summary,
    mode: model.mode,
    modeLabel: model.modeLabel,
    seed: model.seed,
    startHref: model.queueEntries[0]?.href ?? null,
    queuePreview: model.queueEntries.slice(0, 8)
  }
}

/**
 * Rebuilds a practice session deterministically from course, mode, and seed so
 * the learner route can move across chapters without keeping queue state in the
 * browser.
 */
export async function getPracticeSessionForCourse(
  courseSlug: string,
  activeChallengeSlug: string | null,
  options?: {
    mode?: string | null
    seed?: string | null
  }
): Promise<PracticeSessionData | null> {
  const model = await loadCoursePracticeModel(courseSlug, options?.mode, options?.seed)

  if (!model || !model.queueEntries.length) {
    return null
  }

  const activeIndex = Math.max(
    0,
    model.queueEntries.findIndex((entry) => entry.challengeSlug === activeChallengeSlug)
  )

  return {
    mode: model.mode,
    modeLabel: model.modeLabel,
    seed: model.seed,
    queueEntries: model.queueEntries,
    activeIndex,
    previousHref: model.queueEntries[activeIndex - 1]?.href ?? null,
    nextHref: model.queueEntries[activeIndex + 1]?.href ?? null,
    challengeOptions: model.queueEntries.map((entry, index) => ({
      slug: entry.challengeSlug,
      title: entry.challengeTitle,
      href: entry.href
    }))
  }
}

/**
 * Persists one judged review result while hiding the scheduling table and
 * fallback behavior from submission handlers.
 */
export async function saveChallengeReviewResult(
  client: ReviewStateStoreClient,
  payload: {
    userId: string
    challengeId: string
    submissionId: string | null
    result: ReviewResult
    reviewedAt?: Date
  }
) {
  const currentResult = await client
    .from("challenge_review_state")
    .select("challenge_id,last_result,success_streak,successful_attempts,failed_attempts,last_reviewed_at,next_review_at")
    .eq("user_id", payload.userId)
    .eq("challenge_id", payload.challengeId)
    .maybeSingle()

  if (currentResult.error) {
    if (isMissingReviewStateTable({ code: currentResult.error.code, message: currentResult.error.message })) {
      return
    }

    throw new Error(currentResult.error.message)
  }

  const currentState = currentResult.data
    ? mapReviewState(currentResult.data as Record<string, unknown>)
    : createEmptyReviewState(payload.challengeId)
  const nextState = {
    ...scheduleNextChallengeReview(currentState, payload.result, payload.reviewedAt),
    challengeId: payload.challengeId
  }

  const upsertResult = await client.from("challenge_review_state").upsert(
    {
      user_id: payload.userId,
      challenge_id: payload.challengeId,
      last_result: nextState.lastResult,
      success_streak: nextState.successStreak,
      successful_attempts: nextState.successfulAttempts,
      failed_attempts: nextState.failedAttempts,
      last_reviewed_at: nextState.lastReviewedAt,
      next_review_at: nextState.nextReviewAt,
      last_submission_id: payload.submissionId,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,challenge_id"
    }
  )

  if (upsertResult.error && !isMissingReviewStateTable({ code: upsertResult.error.code, message: upsertResult.error.message })) {
    throw new Error(upsertResult.error.message)
  }
}

/**
 * Clears review memory for one challenge when the learner explicitly resets
 * progress, keeping practice state consistent with submission history.
 */
export async function clearChallengeReviewState(
  client: ReviewStateStoreClient,
  payload: {
    userId: string
    challengeId: string
  }
) {
  const result = await client
    .from("challenge_review_state")
    .delete()
    .eq("user_id", payload.userId)
    .eq("challenge_id", payload.challengeId)

  if (result.error && !isMissingReviewStateTable({ code: result.error.code, message: result.error.message })) {
    throw new Error(result.error.message)
  }
}
