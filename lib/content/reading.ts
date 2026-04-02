type EffectiveReadingOptions = {
  lessonBodyMdx: string
  challengeReadingMdx?: string | null
  challengePromptMdx?: string | null
}

function normalizeReadingComparisonText(source: string) {
  return source.replace(/\s+/g, " ").trim()
}

/**
 * Normalizes assignment-level reading overrides so legacy prompt-copied values
 * do not masquerade as intentional custom reading.
 */
export function getMeaningfulAssignmentReadingOverride({
  challengeReadingMdx,
  challengePromptMdx
}: Pick<EffectiveReadingOptions, "challengeReadingMdx" | "challengePromptMdx">) {
  const normalizedChallengeReading = challengeReadingMdx?.trim()
  const normalizedPrompt = challengePromptMdx?.trim()

  if (!normalizedChallengeReading) {
    return ""
  }

  if (
    normalizedPrompt &&
    normalizeReadingComparisonText(normalizedChallengeReading) === normalizeReadingComparisonText(normalizedPrompt)
  ) {
    return ""
  }

  return normalizedChallengeReading
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
