type EffectiveReadingOptions = {
  lessonBodyMdx: string
  challengeReadingMdx?: string | null
  challengePromptMdx?: string | null
}

/**
 * Normalizes the stored assignment reading override into a single obvious
 * string contract for authoring and learner views.
 */
export function getMeaningfulAssignmentReadingOverride({
  challengeReadingMdx,
  challengePromptMdx: _challengePromptMdx
}: Pick<EffectiveReadingOptions, "challengeReadingMdx" | "challengePromptMdx">) {
  return challengeReadingMdx?.trim() ?? ""
}

/**
 * Returns the reading content a learner should see for the active assignment.
 * Assignment-specific reading wins. If no override exists, the assignment
 * prompt becomes the primary reading so switching assignments updates the main
 * reading card consistently. Chapter reading remains a separate chapter-level
 * reference for the lesson.
 */
export function getEffectiveAssignmentReading({
  lessonBodyMdx,
  challengeReadingMdx,
  challengePromptMdx
}: EffectiveReadingOptions) {
  const normalizedChallengeReading = getMeaningfulAssignmentReadingOverride({
    challengeReadingMdx,
    challengePromptMdx
  })
  const normalizedPrompt = challengePromptMdx?.trim()
  const normalizedLessonBody = lessonBodyMdx.trim()

  if (normalizedChallengeReading) {
    return normalizedChallengeReading
  }

  if (normalizedPrompt) {
    return normalizedPrompt
  }

  if (normalizedLessonBody) {
    return normalizedLessonBody
  }

  return ""
}

/**
 * Describes which source currently owns the main learner reading card.
 */
export function getEffectiveAssignmentReadingLabel({
  lessonBodyMdx,
  challengeReadingMdx,
  challengePromptMdx
}: EffectiveReadingOptions) {
  const normalizedChallengeReading = getMeaningfulAssignmentReadingOverride({
    challengeReadingMdx,
    challengePromptMdx
  })
  const normalizedPrompt = challengePromptMdx?.trim()
  const normalizedLessonBody = lessonBodyMdx.trim()

  if (normalizedChallengeReading) {
    return "Assignment-specific reading"
  }

  if (normalizedPrompt) {
    return "Assignment prompt fallback"
  }

  if (normalizedLessonBody) {
    return "Chapter reading"
  }

  return "No reading yet"
}
