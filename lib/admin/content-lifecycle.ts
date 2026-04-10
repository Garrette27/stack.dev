import "server-only"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

export type AdminContentLifecycleResult = {
  success: boolean
  message: string
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

type ChallengeVisibilityRow = {
  id: string
  current_published_version_id: string | null
  current_draft_version_id: string | null
}

/**
 * Centralizes course-catalog visibility changes so authored content stays
 * recoverable even when the learner-facing catalog changes over time.
 */
async function getAuthorizedAdminClient(): Promise<
  | { success: true; admin: AdminClient }
  | { success: false; result: AdminContentLifecycleResult }
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
      result: {
        success: false,
        message: "Content visibility changes are unavailable until admin access is configured for this project."
      }
    }
  }

  return {
    success: true,
    admin: createAdminClient()!
  }
}

function isMissingChallengeStatusColumn(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("status") === true
  )
}

/**
 * Restoring an assignment should make it visible again without discarding its
 * existing draft-vs-published version pointers.
 */
function getRestoredChallengeStatus(challenge: ChallengeVisibilityRow) {
  return challenge.current_published_version_id ? "published" : "draft"
}

async function updateChallengeVisibility(
  admin: AdminClient,
  challengeId: string,
  nextPublished: boolean,
  nextStatus: "draft" | "published" | "archived"
) {
  const nextTimestamp = new Date().toISOString()
  const statusResult = await admin
    .from("challenges")
    .update({
      published: nextPublished,
      status: nextStatus,
      updated_at: nextTimestamp
    })
    .eq("id", challengeId)

  if (!statusResult.error) {
    return { error: null }
  }

  if (isMissingChallengeStatusColumn(statusResult.error)) {
    const fallbackResult = await admin
      .from("challenges")
      .update({
        published: nextPublished,
        updated_at: nextTimestamp
      })
      .eq("id", challengeId)

    return { error: fallbackResult.error }
  }

  return { error: statusResult.error }
}

export async function hideCourseForCurrentUser(courseSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const { error } = await authorized.admin
    .from("courses")
    .update({ published: false })
    .eq("slug", courseSlug)

  if (error) {
    return { success: false, message: error.message }
  }

  return {
    success: true,
    message: "Course hidden from the learner catalog. The authored content is still preserved in admin."
  }
}

export async function restoreCourseForCurrentUser(courseSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const { error } = await authorized.admin
    .from("courses")
    .update({ published: true })
    .eq("slug", courseSlug)

  if (error) {
    return { success: false, message: error.message }
  }

  return {
    success: true,
    message: "Course restored to the learner catalog."
  }
}

export async function hideLessonForCurrentUser(courseSlug: string, lessonSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: courseRow, error: courseError } = await admin
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle()

  if (courseError) {
    return { success: false, message: courseError.message }
  }

  if (!courseRow) {
    return { success: false, message: "Course not found." }
  }

  const { error } = await admin
    .from("lessons")
    .update({ published: false })
    .eq("course_id", courseRow.id)
    .eq("slug", lessonSlug)

  if (error) {
    return { success: false, message: error.message }
  }

  return {
    success: true,
    message: "Chapter hidden from learners. The chapter and its assignments are still preserved in admin."
  }
}

export async function restoreLessonForCurrentUser(courseSlug: string, lessonSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: courseRow, error: courseError } = await admin
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle()

  if (courseError) {
    return { success: false, message: courseError.message }
  }

  if (!courseRow) {
    return { success: false, message: "Course not found." }
  }

  const { error } = await admin
    .from("lessons")
    .update({ published: true })
    .eq("course_id", courseRow.id)
    .eq("slug", lessonSlug)

  if (error) {
    return { success: false, message: error.message }
  }

  return {
    success: true,
    message: "Chapter restored to the learner course page."
  }
}

export async function archiveChallengeForCurrentUser(challengeSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: challengeRow, error: challengeError } = await admin
    .from("challenges")
    .select("id,current_published_version_id,current_draft_version_id")
    .eq("slug", challengeSlug)
    .maybeSingle()

  if (challengeError) {
    return { success: false, message: challengeError.message }
  }

  if (!challengeRow) {
    return { success: false, message: "Assignment not found." }
  }

  const result = await updateChallengeVisibility(admin, String(challengeRow.id), false, "archived")

  if (result.error) {
    return { success: false, message: result.error.message }
  }

  return {
    success: true,
    message: "Assignment archived. The authored content is still preserved and can be restored later."
  }
}

export async function restoreChallengeForCurrentUser(challengeSlug: string): Promise<AdminContentLifecycleResult> {
  const authorized = await getAuthorizedAdminClient()
  if (!authorized.success) {
    return authorized.result
  }

  const admin = authorized.admin
  const { data: challengeRow, error: challengeError } = await admin
    .from("challenges")
    .select("id,current_published_version_id,current_draft_version_id")
    .eq("slug", challengeSlug)
    .maybeSingle()

  if (challengeError) {
    return { success: false, message: challengeError.message }
  }

  if (!challengeRow) {
    return { success: false, message: "Assignment not found." }
  }

  const typedChallenge = challengeRow as ChallengeVisibilityRow
  const result = await updateChallengeVisibility(
    admin,
    String(typedChallenge.id),
    true,
    getRestoredChallengeStatus(typedChallenge)
  )

  if (result.error) {
    return { success: false, message: result.error.message }
  }

  return {
    success: true,
    message: "Assignment restored to the learner chapter."
  }
}
