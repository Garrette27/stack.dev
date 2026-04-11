import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { getDefaultJudge0LanguageId, isSupportedChallengeLanguage } from "@/lib/judge0/languages"
import type {
  Challenge,
  ChallengeBase,
  ChallengeKind,
  ChallengePublicationState,
  CodeChallenge,
  CodeChallengeLanguage,
  LocalLabChallenge,
  MultipleChoiceChallenge,
  PublicationState
} from "@/lib/types"

type ChallengeRecordInput = ChallengeBase & {
  kind: ChallengeKind
  language: string | null
  judge0LanguageId: number | null
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: unknown
  correctChoiceKey: string | null
  choiceExplanationMdx: string
}

/**
 * Normalizes raw storage rows into the specific challenge variant the rest of
 * the app should consume, so mapper callers never need to remember which
 * fields are meaningful for each assignment kind.
 */
export function buildChallengeRecord(input: ChallengeRecordInput): Challenge {
  if (input.kind === "multiple_choice") {
    const choiceOptions = normalizeMultipleChoiceOptions(input.choiceOptions)
    const correctChoiceKey = input.correctChoiceKey ?? choiceOptions[0]?.key ?? ""

    return {
      ...input,
      kind: "multiple_choice",
      language: null,
      judge0LanguageId: null,
      starterCode: "",
      solutionCode: "",
      hiddenTestCode: "",
      choiceOptions,
      correctChoiceKey,
      choiceExplanationMdx: input.choiceExplanationMdx
    } satisfies MultipleChoiceChallenge
  }

  if (input.kind === "local_lab") {
    return {
      ...input,
      kind: "local_lab",
      language: null,
      judge0LanguageId: null,
      starterCode: input.starterCode,
      solutionCode: input.solutionCode,
      hiddenTestCode: input.hiddenTestCode,
      choiceOptions: [],
      correctChoiceKey: null,
      choiceExplanationMdx: ""
    } satisfies LocalLabChallenge
  }

  const language = normalizeCodeChallengeLanguage(input.language)

  return {
    ...input,
    kind: "code",
    language,
    judge0LanguageId: input.judge0LanguageId ?? getDefaultJudge0LanguageId(language),
    starterCode: input.starterCode,
    solutionCode: input.solutionCode,
    hiddenTestCode: input.hiddenTestCode,
    choiceOptions: [],
    correctChoiceKey: null,
    choiceExplanationMdx: ""
  } satisfies CodeChallenge
}

export function isCodeChallenge(challenge: Challenge): challenge is CodeChallenge {
  return challenge.kind === "code"
}

export function isMultipleChoiceChallenge(challenge: Challenge): challenge is MultipleChoiceChallenge {
  return challenge.kind === "multiple_choice"
}

export function isLocalLabChallenge(challenge: Challenge): challenge is LocalLabChallenge {
  return challenge.kind === "local_lab"
}

export function normalizeChallengeKind(value: unknown): ChallengeKind {
  const normalizedValue = String(value ?? "code")
  if (normalizedValue === "multiple_choice" || normalizedValue === "local_lab") {
    return normalizedValue
  }

  return "code"
}

export function normalizePublicationState(
  value: unknown,
  published: boolean
): PublicationState {
  const normalizedValue = String(value ?? "")
  if (normalizedValue === "draft" || normalizedValue === "published" || normalizedValue === "archived") {
    return normalizedValue
  }

  return published ? "published" : "draft"
}

export const normalizeChallengePublicationState = normalizePublicationState

export function normalizeCodeChallengeLanguage(value: unknown): CodeChallengeLanguage {
  const normalizedValue = value == null ? null : String(value)
  if (normalizedValue && isSupportedChallengeLanguage(normalizedValue)) {
    return normalizedValue
  }

  return "python"
}
