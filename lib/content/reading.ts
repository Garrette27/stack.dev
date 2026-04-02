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
 * Assignment-specific reading wins. If no override exists, chapter reading is
 * the default source. A prompt-only fallback is used only when the chapter has
 * no reading at all.
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

  if (normalizedLessonBody) {
    return normalizedLessonBody
  }

  if (normalizedChallengeReading) {
    return normalizedChallengeReading
  }

  if (normalizedPrompt) {
    return normalizedPrompt
  }

  return ""
}

/**
 * Describes whether the learner is seeing a chapter-level or assignment-level
 * reading source for the selected assignment.
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

  if (normalizedLessonBody) {
    return "Chapter reading"
  }

  if (normalizedChallengeReading || normalizedPrompt) {
    return "Assignment prompt fallback"
  }

  return "No reading yet"
}
