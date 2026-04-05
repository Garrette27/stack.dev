import type { ChallengeKind, MultipleChoiceOption } from "@/lib/types"

const AUTHORING_SESSION_STORAGE_KEY = "stack.authoring.session.v1"

export type PersistedAuthoringSelection = {
  courseSlug: string
  lessonSlug: string
  challengeSlug: string
}

export type PersistedLessonDraft = {
  courseTitle: string
  lessonTitle: string
  bodyMdx: string
}

export type PersistedAssignmentDraft = {
  challengeKind: ChallengeKind
  language: string
  judge0LanguageId: string
  readingMdx: string
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string
  choiceExplanationMdx: string
}

type PersistedAuthoringSession = {
  selection: PersistedAuthoringSelection | null
  lessonDraftsByKey: Record<string, PersistedLessonDraft>
  assignmentDraftsByKey: Record<string, PersistedAssignmentDraft>
}

function getEmptySession(): PersistedAuthoringSession {
  return {
    selection: null,
    lessonDraftsByKey: {},
    assignmentDraftsByKey: {}
  }
}

function canUseStorage() {
  return typeof window !== "undefined"
}

/**
 * Keeps author continuity behind one small storage contract so the admin form
 * can restore the last editing context without leaking persistence details.
 */
function readPersistedAuthoringSession(): PersistedAuthoringSession {
  if (!canUseStorage()) {
    return getEmptySession()
  }

  try {
    const rawValue = window.localStorage.getItem(AUTHORING_SESSION_STORAGE_KEY)
    if (!rawValue) {
      return getEmptySession()
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedAuthoringSession>

    return {
      selection:
        parsed.selection &&
        typeof parsed.selection.courseSlug === "string" &&
        typeof parsed.selection.lessonSlug === "string" &&
        typeof parsed.selection.challengeSlug === "string"
          ? {
              courseSlug: parsed.selection.courseSlug,
              lessonSlug: parsed.selection.lessonSlug,
              challengeSlug: parsed.selection.challengeSlug
            }
          : null,
      lessonDraftsByKey:
        parsed.lessonDraftsByKey && typeof parsed.lessonDraftsByKey === "object"
          ? (parsed.lessonDraftsByKey as Record<string, PersistedLessonDraft>)
          : {},
      assignmentDraftsByKey:
        parsed.assignmentDraftsByKey && typeof parsed.assignmentDraftsByKey === "object"
          ? (parsed.assignmentDraftsByKey as Record<string, PersistedAssignmentDraft>)
          : {}
    }
  } catch {
    return getEmptySession()
  }
}

function writePersistedAuthoringSession(session: PersistedAuthoringSession) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(AUTHORING_SESSION_STORAGE_KEY, JSON.stringify(session))
}

/**
 * Gives chapter-level drafts their own key so shared reading and titles stop
 * leaking across assignment-specific draft restoration.
 */
export function buildPersistedLessonDraftKey(selection: Pick<PersistedAuthoringSelection, "courseSlug" | "lessonSlug">) {
  return `${selection.courseSlug}::${selection.lessonSlug}`
}

/**
 * Gives assignment-level drafts a stable key inside the selected chapter.
 */
export function buildPersistedAssignmentDraftKey(selection: PersistedAuthoringSelection) {
  return `${selection.courseSlug}::${selection.lessonSlug}::${selection.challengeSlug}`
}

export function readPersistedAuthoringSelection() {
  return readPersistedAuthoringSession().selection
}

export function writePersistedAuthoringSelection(selection: PersistedAuthoringSelection | null) {
  const session = readPersistedAuthoringSession()
  session.selection = selection
  writePersistedAuthoringSession(session)
}

export function readPersistedLessonDraft(draftKey: string) {
  const session = readPersistedAuthoringSession()
  return session.lessonDraftsByKey[draftKey] ?? null
}

export function writePersistedLessonDraft(draftKey: string, draft: PersistedLessonDraft) {
  const session = readPersistedAuthoringSession()
  session.lessonDraftsByKey[draftKey] = draft
  writePersistedAuthoringSession(session)
}

export function readPersistedAssignmentDraft(draftKey: string) {
  const session = readPersistedAuthoringSession()
  return session.assignmentDraftsByKey[draftKey] ?? null
}

export function writePersistedAssignmentDraft(draftKey: string, draft: PersistedAssignmentDraft) {
  const session = readPersistedAuthoringSession()
  session.assignmentDraftsByKey[draftKey] = draft
  writePersistedAuthoringSession(session)
}
