import "server-only"

export type AdminDeleteResult = {
  success: boolean
  message: string
}

/**
 * Hard deletion is intentionally disabled so authored catalog content stays
 * recoverable even as admin features evolve.
 */
export async function deleteChallengeForCurrentUser(challengeSlug: string): Promise<AdminDeleteResult> {
  return {
    success: false,
    message: `Hard deletion is disabled for "${challengeSlug}". Archive the assignment instead so authored content stays recoverable.`
  }
}

/**
 * Hard deletion is intentionally disabled so chapter-level authored work stays
 * attached to the catalog even when learner visibility changes.
 */
export async function deleteLessonForCurrentUser(courseSlug: string, lessonSlug: string): Promise<AdminDeleteResult> {
  return {
    success: false,
    message: `Hard deletion is disabled for "${courseSlug}/${lessonSlug}". Hide the chapter instead so the authored work stays intact.`
  }
}

/**
 * Hard deletion is intentionally disabled so course catalogs remain stable and
 * recoverable over time.
 */
export async function deleteCourseForCurrentUser(courseSlug: string): Promise<AdminDeleteResult> {
  return {
    success: false,
    message: `Hard deletion is disabled for "${courseSlug}". Hide the course instead so the authored catalog can be restored later.`
  }
}
