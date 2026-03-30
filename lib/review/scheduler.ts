export type ReviewResult = "passed" | "failed"
export type ReviewStatus = "unseen" | ReviewResult
export type ReviewBucket = "new" | "learning" | "review" | "mastered"

export type ChallengeReviewState = {
  challengeId: string
  lastResult: ReviewStatus
  successStreak: number
  successfulAttempts: number
  failedAttempts: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
}

export type PracticeQueueItem = {
  challengeId: string
  bucket: ReviewBucket
  dueAt: string | null
}

const FAILURE_INTERVAL_MINUTES = 10
const SUCCESS_INTERVALS_IN_MINUTES = [
  1 * 24 * 60,
  3 * 24 * 60,
  7 * 24 * 60,
  14 * 24 * 60,
  30 * 24 * 60
]

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function createSeededRandom(seed: string) {
  let hash = 1779033703 ^ seed.length

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    const normalized = (hash ^= hash >>> 16) >>> 0
    return normalized / 4294967296
  }
}

function shuffleInPlace<T>(values: T[], seed: string) {
  const nextRandom = createSeededRandom(seed)

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }

  return values
}

/**
 * Schedules the next review moment using a simple staircase that is easier to
 * explain than a full SM-2 implementation while still supporting spaced
 * repetition and quick retries after a miss.
 */
export function scheduleNextChallengeReview(
  state: ChallengeReviewState | null,
  result: ReviewResult,
  reviewedAt = new Date()
): ChallengeReviewState {
  if (result === "failed") {
    return {
      challengeId: state?.challengeId ?? "",
      lastResult: "failed",
      successStreak: 0,
      successfulAttempts: state?.successfulAttempts ?? 0,
      failedAttempts: (state?.failedAttempts ?? 0) + 1,
      lastReviewedAt: reviewedAt.toISOString(),
      nextReviewAt: addMinutes(reviewedAt, FAILURE_INTERVAL_MINUTES).toISOString()
    }
  }

  const nextSuccessStreak = (state?.successStreak ?? 0) + 1
  const intervalIndex = Math.min(nextSuccessStreak - 1, SUCCESS_INTERVALS_IN_MINUTES.length - 1)

  return {
    challengeId: state?.challengeId ?? "",
    lastResult: "passed",
    successStreak: nextSuccessStreak,
    successfulAttempts: (state?.successfulAttempts ?? 0) + 1,
    failedAttempts: state?.failedAttempts ?? 0,
    lastReviewedAt: reviewedAt.toISOString(),
    nextReviewAt: addMinutes(reviewedAt, SUCCESS_INTERVALS_IN_MINUTES[intervalIndex]).toISOString()
  }
}

/**
 * Classifies one review state into a learner-facing bucket so playlist-style
 * practice can prioritize misses, unseen work, and due reviews cleanly.
 */
export function getReviewBucket(state: ChallengeReviewState | null, now = new Date()): ReviewBucket {
  if (!state || state.lastResult === "unseen") {
    return "new"
  }

  const dueAt = state.nextReviewAt ? new Date(state.nextReviewAt).getTime() : null
  const isDue = dueAt === null || dueAt <= now.getTime()

  if (state.lastResult === "failed") {
    return "learning"
  }

  if (state.successStreak >= 4 && !isDue) {
    return "mastered"
  }

  return "review"
}

/**
 * Produces a due-first shuffled queue similar to playlist shuffle, but keeps
 * educational priority order: learning misses, unseen questions, due reviews,
 * then already-mastered questions.
 */
export function buildPracticeQueue(
  challengeIds: string[],
  states: ChallengeReviewState[],
  options?: {
    now?: Date
    seed?: string
  }
): PracticeQueueItem[] {
  const now = options?.now ?? new Date()
  const seed = options?.seed ?? now.toISOString().slice(0, 10)
  const stateByChallengeId = new Map(states.map((state) => [state.challengeId, state]))

  const grouped = {
    learning: [] as PracticeQueueItem[],
    new: [] as PracticeQueueItem[],
    review: [] as PracticeQueueItem[],
    mastered: [] as PracticeQueueItem[]
  }

  challengeIds.forEach((challengeId) => {
    const state = stateByChallengeId.get(challengeId) ?? null
    const bucket = getReviewBucket(state, now)
    const item = {
      challengeId,
      bucket,
      dueAt: state?.nextReviewAt ?? null
    }

    grouped[bucket].push(item)
  })

  return [
    ...shuffleInPlace(grouped.learning, `${seed}:learning`),
    ...shuffleInPlace(grouped.new, `${seed}:new`),
    ...shuffleInPlace(grouped.review, `${seed}:review`),
    ...shuffleInPlace(grouped.mastered, `${seed}:mastered`)
  ]
}
