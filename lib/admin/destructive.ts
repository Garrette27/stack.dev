import "server-only"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

export type AdminDeleteResult = {
  success: boolean
  message: string
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

type LessonRef = {
  id: string
  slug: string
  challengeSlug: string | null
}

type ChallengeRef = {
  id: string
  slug: string
}

/**
 * Returns an admin client for destructive actions and keeps authorization
 * checks out of the page and action layers.
 */
async function getAuthorizedAdminClient(): Promise<
  | { success: true; admin: AdminClient }
  | { success: false; result: AdminDeleteResult }
> {
  const user = await getCurrentUser()
  const isAdmin = user ? await isCurrentUserAdmin() : false

  if (!user) {
    return {
      success: false,
      result: { success: false, message: "Sign in first." }
    }
  }

  if (!isAdmin) {
    return {
      success: false,
      result: { success: false, message: "This account does not have authoring access." }
    }
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      result: { success: false, message: "Deleting content is unavailable until admin access is configured for this project." }
    }
  }

  return {
    success: true,
    admin: createAdminClient()!
  }
}

/**
 * Loads lesson-to-challenge relations while remaining compatible with the
 * legacy single-challenge lesson column.
 */
async function getLessonChallengeMap(admin: AdminClient, lessons: LessonRef[]) {
  const challengeIdsByLessonId = new Map<string, string[]>()

  if (!lessons.length) {
    return challengeIdsByLessonId
  }

  const lessonIds = lessons.map((lesson) => lesson.id)
  const { data, error } = await admin
    .from("lesson_challenges")
    .select("lesson_id,challenge_id,order_index")
    .in("lesson_id", lessonIds)
    .order("order_index")

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    const { data: challenges } = await admin.from("challenges").select("id,slug")
    const challengeIdBySlug = new Map((challenges ?? []).map((challenge) => [String(challenge.slug), String(challenge.id)]))

    lessons.forEach((lesson) => {
      const challengeId = lesson.challengeSlug ? challengeIdBySlug.get(lesson.challengeSlug) : null
      challengeIdsByLessonId.set(lesson.id, challengeId ? [challengeId] : [])
    })

    return challengeIdsByLessonId
  }

  if (error) {
    throw new Error(error.message)
  }

  ;(data ?? []).forEach((row) => {
    const lessonId = String(row.lesson_id)
    const challengeId = String(row.challenge_id)
    const challengeIds = challengeIdsByLessonId.get(lessonId) ?? []
    challengeIds.push(challengeId)
    challengeIdsByLessonId.set(lessonId, challengeIds)
  })

  lessons.forEach((lesson) => {
    if (!challengeIdsByLessonId.has(lesson.id)) {
      challengeIdsByLessonId.set(lesson.id, [])
    }
  })

  return challengeIdsByLessonId
}

/**
 * Keeps the legacy `lessons.challenge_slug` column aligned with the first
 * attached assignment so older readers stay consistent during the migration.
 */
async function syncLegacyChallengePointers(admin: AdminClient, lessonIds: string[]) {
  if (!lessonIds.length) {
    return
  }

  const { data: relationRows, error: relationError } = await admin
    .from("lesson_challenges")
    .select("lesson_id,challenge_id,order_index")
    .in("lesson_id", lessonIds)
    .order("order_index")

  if (relationError?.code === "42P01" || relationError?.code === "PGRST205") {
    return
  }

  if (relationError) {
    throw new Error(relationError.message)
  }

  const challengeIds = Array.from(new Set((relationRows ?? []).map((row) => String(row.challenge_id))))
  const { data: challengeRows, error: challengeError } = await admin.from("challenges").select("id,slug").in("id", challengeIds)

  if (challengeError) {
    throw new Error(challengeError.message)
  }

  const challengeSlugById = new Map((challengeRows ?? []).map((challenge) => [String(challenge.id), String(challenge.slug)]))
  const nextChallengeSlugByLessonId = new Map<string, string | null>()

  ;(relationRows ?? []).forEach((row) => {
    const lessonId = String(row.lesson_id)
    if (!nextChallengeSlugByLessonId.has(lessonId)) {
      nextChallengeSlugByLessonId.set(lessonId, challengeSlugById.get(String(row.challenge_id)) ?? null)
    }
  })

  await Promise.all(
    lessonIds.map((lessonId) =>
      admin.from("lessons").update({ challenge_slug: nextChallengeSlugByLessonId.get(lessonId) ?? null }).eq("id", lessonId)
    )
  )
}

/**
 * Deletes challenges that are no longer attached to any lesson and removes
 * their submissions at the same time.
 */
async function deleteOrphanChallenges(admin: AdminClient, challengeIds: string[]) {
  if (!challengeIds.length) {
    return
  }

  const uniqueChallengeIds = Array.from(new Set(challengeIds))
  const { data: challengeRows, error: challengeError } = await admin.from("challenges").select("id,slug").in("id", uniqueChallengeIds)

  if (challengeError) {
    throw new Error(challengeError.message)
  }

  const remainingRelationIds = new Set<string>()
  const { data: relationRows, error: relationError } = await admin.from("lesson_challenges").select("challenge_id").in("challenge_id", uniqueChallengeIds)

  if (!relationError) {
    ;(relationRows ?? []).forEach((row) => remainingRelationIds.add(String(row.challenge_id)))
  } else if (relationError.code !== "42P01" && relationError.code !== "PGRST205") {
    throw new Error(relationError.message)
  }

  const challengeSlugs = (challengeRows ?? []).map((challenge) => String(challenge.slug))
  const { data: legacyLessonRows, error: legacyLessonError } = await admin.from("lessons").select("challenge_slug").in("challenge_slug", challengeSlugs)

  if (legacyLessonError) {
    throw new Error(legacyLessonError.message)
  }

  const legacyChallengeSlugs = new Set((legacyLessonRows ?? []).map((row) => String(row.challenge_slug)))
  const orphanChallenges = (challengeRows ?? []).filter(
    (challenge) => !remainingRelationIds.has(String(challenge.id)) && !legacyChallengeSlugs.has(String(challenge.slug))
  )

  if (!orphanChallenges.length) {
    return
  }

  const orphanIds = orphanChallenges.map((challenge) => String(challenge.id))

  await admin.from("submissions").delete().in("challenge_id", orphanIds)
  await admin.from("challenges").delete().in("id", orphanIds)
}

/**
 * Deletes a single assignment and detaches it from any chapter that still
 * references it.
 */
export async function deleteChallengeForCurrentUser(challengeSlug: string): Promise<AdminDeleteResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: challengeRow, error: challengeError } = await admin
    .from("challenges")
    .select("id,slug")
    .eq("slug", challengeSlug)
    .maybeSingle()

  if (challengeError) {
    return { success: false, message: challengeError.message }
  }

  const challenge = (challengeRow ?? null) as ChallengeRef | null

  if (!challenge) {
    return { success: true, message: "Assignment already removed." }
  }

  const { data: relationRows, error: relationError } = await admin
    .from("lesson_challenges")
    .select("lesson_id")
    .eq("challenge_id", challenge.id)

  if (!relationError) {
    await admin.from("lesson_challenges").delete().eq("challenge_id", challenge.id)
    await syncLegacyChallengePointers(
      admin,
      Array.from(new Set((relationRows ?? []).map((row) => String(row.lesson_id))))
    )
  } else if (relationError.code === "42P01" || relationError.code === "PGRST205") {
    await admin.from("lessons").update({ challenge_slug: null }).eq("challenge_slug", challengeSlug)
  } else {
    return { success: false, message: relationError.message }
  }

  await deleteOrphanChallenges(admin, [challenge.id])

  return {
    success: true,
    message: "Assignment deleted."
  }
}

/**
 * Deletes a chapter and any orphaned assignments that belonged only to it.
 */
export async function deleteLessonForCurrentUser(courseSlug: string, lessonSlug: string): Promise<AdminDeleteResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: courseRow, error: courseError } = await admin.from("courses").select("id").eq("slug", courseSlug).maybeSingle()

  if (courseError) {
    return { success: false, message: courseError.message }
  }

  if (!courseRow) {
    return { success: true, message: "Course already removed." }
  }

  const { data: lessonRow, error: lessonError } = await admin
    .from("lessons")
    .select("id,slug,challenge_slug")
    .eq("course_id", courseRow.id)
    .eq("slug", lessonSlug)
    .maybeSingle()

  if (lessonError) {
    return { success: false, message: lessonError.message }
  }

  const lesson = (lessonRow ?? null) as LessonRef | null

  if (!lesson) {
    return { success: true, message: "Chapter already removed." }
  }

  const challengeIdsByLessonId = await getLessonChallengeMap(admin, [lesson])
  const challengeIds = challengeIdsByLessonId.get(lesson.id) ?? []

  await admin.from("lesson_progress").delete().eq("lesson_id", lesson.id)
  await admin.from("resume_state").delete().eq("course_slug", courseSlug).eq("lesson_slug", lessonSlug)
  await admin.from("lesson_challenges").delete().eq("lesson_id", lesson.id)

  const { error: deleteLessonError } = await admin.from("lessons").delete().eq("id", lesson.id)
  if (deleteLessonError) {
    return { success: false, message: deleteLessonError.message }
  }

  await deleteOrphanChallenges(admin, challengeIds)

  return {
    success: true,
    message: "Chapter deleted."
  }
}

/**
 * Deletes a course, its chapters, and any assignments that no longer belong
 * to another chapter.
 */
export async function deleteCourseForCurrentUser(courseSlug: string): Promise<AdminDeleteResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: courseRow, error: courseError } = await admin.from("courses").select("id").eq("slug", courseSlug).maybeSingle()

  if (courseError) {
    return { success: false, message: courseError.message }
  }

  if (!courseRow) {
    return { success: true, message: "Course already removed." }
  }

  const { data: lessonRows, error: lessonError } = await admin
    .from("lessons")
    .select("id,slug,challenge_slug")
    .eq("course_id", courseRow.id)

  if (lessonError) {
    return { success: false, message: lessonError.message }
  }

  const lessons: LessonRef[] = (lessonRows ?? []).map((lesson) => ({
    id: String(lesson.id),
    slug: String(lesson.slug),
    challengeSlug: lesson.challenge_slug ? String(lesson.challenge_slug) : null
  }))
  const lessonIds = lessons.map((lesson) => lesson.id)
  const challengeIdsByLessonId = await getLessonChallengeMap(admin, lessons)
  const candidateChallengeIds = lessons.flatMap((lesson) => challengeIdsByLessonId.get(lesson.id) ?? [])

  if (lessonIds.length) {
    await admin.from("lesson_progress").delete().in("lesson_id", lessonIds)
    await admin.from("lesson_challenges").delete().in("lesson_id", lessonIds)
    await admin.from("lessons").delete().in("id", lessonIds)
  }

  await admin.from("resume_state").delete().eq("course_slug", courseSlug)

  const { error: deleteCourseError } = await admin.from("courses").delete().eq("id", courseRow.id)
  if (deleteCourseError) {
    return { success: false, message: deleteCourseError.message }
  }

  await deleteOrphanChallenges(admin, candidateChallengeIds)

  return {
    success: true,
    message: "Course deleted."
  }
}
