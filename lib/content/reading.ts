type EffectiveReadingOptions = {
  lessonBodyMdx: string
  challengeReadingMdx?: string | null
  challengePromptMdx?: string | null
}

export type AssignmentReadingLabel =
  | "Assignment-specific reading"
  | "Assignment prompt"
  | "Chapter guide"
  | "No reading yet"

export type ResolvedAssignmentReading = {
  mainReadingMdx: string
  mainReadingLabel: AssignmentReadingLabel
  chapterGuideMdx: string
}

function normalizeMdx(source?: string | null) {
  return source?.trim() ?? ""
}

/**
 * Normalizes the stored assignment reading override into a single obvious
 * string contract for authoring and learner views.
 */
export function getMeaningfulAssignmentReadingOverride({
  challengeReadingMdx
}: Pick<EffectiveReadingOptions, "challengeReadingMdx">) {
  return normalizeMdx(challengeReadingMdx)
}

/**
 * Resolves the learner reading experience behind one small interface.
 * Assignment-specific reading wins, then the assignment prompt, while the
 * chapter guide remains an optional supporting panel instead of taking over
 * every assignment by default.
 */
export function resolveAssignmentReading(options: EffectiveReadingOptions): ResolvedAssignmentReading {
  const assignmentReading = getMeaningfulAssignmentReadingOverride(options)
  const assignmentPrompt = normalizeMdx(options.challengePromptMdx)
  const chapterGuide = normalizeMdx(options.lessonBodyMdx)

  if (assignmentReading) {
    return {
      mainReadingMdx: assignmentReading,
      mainReadingLabel: "Assignment-specific reading",
      chapterGuideMdx: chapterGuide && chapterGuide !== assignmentReading ? chapterGuide : ""
    }
  }

  if (assignmentPrompt) {
    return {
      mainReadingMdx: assignmentPrompt,
      mainReadingLabel: "Assignment prompt",
      chapterGuideMdx: chapterGuide && chapterGuide !== assignmentPrompt ? chapterGuide : ""
    }
  }

  if (chapterGuide) {
    return {
      mainReadingMdx: chapterGuide,
      mainReadingLabel: "Chapter guide",
      chapterGuideMdx: ""
    }
  }

  return {
    mainReadingMdx: "",
    mainReadingLabel: "No reading yet",
    chapterGuideMdx: ""
  }
}

/**
 * Returns the primary reading content a learner should see for the active
 * assignment.
 */
export function getEffectiveAssignmentReading(options: EffectiveReadingOptions) {
  return resolveAssignmentReading(options).mainReadingMdx
}

/**
 * Describes which source currently owns the main learner reading card.
 */
export function getEffectiveAssignmentReadingLabel(options: EffectiveReadingOptions) {
  return resolveAssignmentReading(options).mainReadingLabel
}

/**
 * Exposes the optional chapter guide without leaking the fallback rules into
 * callers.
 */
export function getChapterGuideReading(options: EffectiveReadingOptions) {
  return resolveAssignmentReading(options).chapterGuideMdx
}
