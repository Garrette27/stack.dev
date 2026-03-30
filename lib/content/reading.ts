type EffectiveReadingOptions = {
  lessonBodyMdx: string
  challengeReadingMdx?: string | null
  challengePromptMdx?: string | null
}

/**
 * Returns the reading content a learner should see for the active assignment.
 * Assignment-specific reading wins, then chapter reading plus prompt fallback,
 * so routing and form layers do not need to duplicate that decision.
 */
export function getEffectiveAssignmentReading({
  lessonBodyMdx,
  challengeReadingMdx,
  challengePromptMdx
}: EffectiveReadingOptions) {
  const normalizedChallengeReading = challengeReadingMdx?.trim()
  const normalizedPrompt = challengePromptMdx?.trim()
  const normalizedLessonBody = lessonBodyMdx.trim()

  if (normalizedChallengeReading) {
    return normalizedChallengeReading
  }

  if (!normalizedPrompt) {
    return normalizedLessonBody
  }

  if (!normalizedLessonBody) {
    return normalizedPrompt
  }

  return `${normalizedLessonBody}

## Assignment focus

${normalizedPrompt}`
}

/**
 * Describes whether the learner is seeing a chapter-level or assignment-level
 * reading source for the selected assignment.
 */
export function getEffectiveAssignmentReadingLabel({
  challengeReadingMdx,
  challengePromptMdx
}: Pick<EffectiveReadingOptions, "challengeReadingMdx" | "challengePromptMdx">) {
  if (challengeReadingMdx?.trim()) {
    return "Assignment-specific reading"
  }

  if (challengePromptMdx?.trim()) {
    return "Assignment prompt fallback"
  }

  return "Chapter reading"
}
