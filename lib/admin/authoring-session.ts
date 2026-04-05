import type { ChallengeKind, MultipleChoiceOption } from "@/lib/types"

const AUTHORING_SESSION_STORAGE_KEY = "stack.authoring.session.v1"

export type PersistedAuthoringSelection = {
  courseSlug: string
  lessonSlug: string
  challengeSlug: string
}

export type PersistedAuthoringDraft = {
  courseTitle: string
  lessonTitle: string
  bodyMdx: string
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
  draftsByKey: Record<string, PersistedAuthoringDraft>
}

function getEmptySession(): PersistedAuthoringSession {
  return {
    selection: null,
    draftsByKey: {}
  }
}

function canUseStorage() {
  return typeof window !== "undefined"
}

/**
 * Keeps all authoring continuity in one browser session payload so the admin
 * form can restore the author's place without scattering storage details.
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
      draftsByKey:
        parsed.draftsByKey && typeof parsed.draftsByKey === "object"
          ? (parsed.draftsByKey as Record<string, PersistedAuthoringDraft>)
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
 * Encodes the authoring target into a single opaque key so the form can keep
 * draft state per course/chapter/assignment without leaking that storage shape.
 */
export function buildPersistedAuthoringDraftKey(selection: PersistedAuthoringSelection) {
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

export function readPersistedAuthoringDraft(draftKey: string) {
  const session = readPersistedAuthoringSession()
  return session.draftsByKey[draftKey] ?? null
}

export function writePersistedAuthoringDraft(draftKey: string, draft: PersistedAuthoringDraft) {
  const session = readPersistedAuthoringSession()
  session.draftsByKey[draftKey] = draft
  writePersistedAuthoringSession(session)
}
