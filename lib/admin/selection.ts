export type AdminAuthoringSelection = {
  courseSlug?: string | null
  lessonSlug?: string | null
  challengeSlug?: string | null
}

/**
 * Builds the canonical admin authoring URL for a course/chapter/assignment
 * selection. Sharing this helper keeps admin links and redirects consistent.
 */
export function buildAdminSelectionHref(selection: AdminAuthoringSelection) {
  const params = new URLSearchParams()

  if (selection.courseSlug) {
    params.set("authorCourse", selection.courseSlug)
  }

  if (selection.lessonSlug) {
    params.set("authorLesson", selection.lessonSlug)
  }

  if (selection.challengeSlug) {
    params.set("authorAssignment", selection.challengeSlug)
  }

  const query = params.toString()
  return query ? `/admin?${query}` : "/admin"
}
