import "server-only"

import {
  setChallengeVisibilityForCurrentUser,
  setCourseVisibilityForCurrentUser,
  setLessonVisibilityForCurrentUser
} from "@/lib/admin/catalog-workflows"

export type AdminContentLifecycleResult = {
  success: boolean
  message: string
}

/**
 * Preserves the old lifecycle entry points while delegating all visibility
 * changes to the newer catalog workflow module.
 */
export async function hideCourseForCurrentUser(courseSlug: string): Promise<AdminContentLifecycleResult> {
  return setCourseVisibilityForCurrentUser(courseSlug, false)
}

export async function restoreCourseForCurrentUser(courseSlug: string): Promise<AdminContentLifecycleResult> {
  return setCourseVisibilityForCurrentUser(courseSlug, true)
}

export async function hideLessonForCurrentUser(
  courseSlug: string,
  lessonSlug: string
): Promise<AdminContentLifecycleResult> {
  return setLessonVisibilityForCurrentUser(courseSlug, lessonSlug, false)
}

export async function restoreLessonForCurrentUser(
  courseSlug: string,
  lessonSlug: string
): Promise<AdminContentLifecycleResult> {
  return setLessonVisibilityForCurrentUser(courseSlug, lessonSlug, true)
}

export async function archiveChallengeForCurrentUser(challengeSlug: string): Promise<AdminContentLifecycleResult> {
  return setChallengeVisibilityForCurrentUser(challengeSlug, false)
}

export async function restoreChallengeForCurrentUser(challengeSlug: string): Promise<AdminContentLifecycleResult> {
  return setChallengeVisibilityForCurrentUser(challengeSlug, true)
}
