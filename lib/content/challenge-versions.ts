import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { getDefaultJudge0LanguageId, isSupportedChallengeLanguage } from "@/lib/judge0/languages"
import type { Challenge, ChallengeKind, ChallengePublicationState } from "@/lib/types"

export type ChallengeVersionLoadMode = "published" | "draft_or_published"

type ChallengeContentRow = Record<string, unknown>

function mapChallengeKind(value: unknown): ChallengeKind {
  return String(value ?? "code") === "multiple_choice" ? "multiple_choice" : "code"
}

function mapChallengeLanguage(value: unknown, kind: ChallengeKind) {
  const languageValue = value == null ? null : String(value)
  if (!languageValue) {
    return kind === "code" ? "python" : null
  }

  return isSupportedChallengeLanguage(languageValue)
    ? languageValue
    : kind === "code"
      ? "python"
      : null
}

function mapChallengePublicationState(value: unknown, published: boolean): ChallengePublicationState {
  const normalizedValue = String(value ?? "")
  if (normalizedValue === "draft" || normalizedValue === "published" || normalizedValue === "archived") {
    return normalizedValue
  }

  return published ? "published" : "draft"
}

function getVersionLookup(versionRows: Record<string, unknown>[] | null | undefined) {
  return new Map((versionRows ?? []).map((row) => [String(row.id), row]))
}

function getActiveChallengeVersionRow(
  challengeRow: Record<string, unknown>,
  versionById: Map<string, Record<string, unknown>>,
  mode: ChallengeVersionLoadMode
) {
  const publishedVersionId = challengeRow.current_published_version_id
    ? String(challengeRow.current_published_version_id)
    : null
  const draftVersionId = challengeRow.current_draft_version_id
    ? String(challengeRow.current_draft_version_id)
    : null

  if (mode === "draft_or_published" && draftVersionId) {
    return versionById.get(draftVersionId) ?? null
  }

  if (publishedVersionId) {
    return versionById.get(publishedVersionId) ?? null
  }

  if (draftVersionId) {
    return versionById.get(draftVersionId) ?? null
  }

  return null
}

function mapChallengeFromContentRows(challengeRow: Record<string, unknown>, contentRow: ChallengeContentRow | null): Challenge {
  const published = Boolean(challengeRow.published ?? true)
  const publicationState = mapChallengePublicationState(contentRow?.status, published)
  const kind = mapChallengeKind(contentRow?.kind ?? challengeRow.kind)
  const language = mapChallengeLanguage(contentRow?.language ?? challengeRow.language, kind)
  const judge0LanguageId =
    typeof contentRow?.judge0_language_id === "number"
      ? contentRow.judge0_language_id
      : typeof challengeRow.judge0_language_id === "number"
        ? challengeRow.judge0_language_id
        : language
          ? getDefaultJudge0LanguageId(language)
          : null

  return {
    id: String(challengeRow.id),
    slug: String(challengeRow.slug),
    title: String(contentRow?.title ?? challengeRow.title),
    versionId: contentRow?.id ? String(contentRow.id) : null,
    versionNumber:
      typeof contentRow?.version_number === "number"
        ? contentRow.version_number
        : contentRow?.version_number
          ? Number(contentRow.version_number)
          : null,
    publishedVersionId: challengeRow.current_published_version_id ? String(challengeRow.current_published_version_id) : null,
    draftVersionId: challengeRow.current_draft_version_id ? String(challengeRow.current_draft_version_id) : null,
    publicationState,
    kind,
    language,
    judge0LanguageId,
    readingMdx: String(contentRow?.reading_mdx ?? challengeRow.reading_mdx ?? ""),
    promptMdx: String(contentRow?.prompt_mdx ?? challengeRow.prompt_mdx ?? ""),
    starterCode: String(contentRow?.starter_code ?? challengeRow.starter_code ?? ""),
    solutionCode: String(contentRow?.solution_code ?? challengeRow.solution_code ?? ""),
    hiddenTestCode: String(contentRow?.hidden_test_code ?? challengeRow.hidden_test_code ?? ""),
    choiceOptions: normalizeMultipleChoiceOptions(contentRow?.choice_options ?? challengeRow.choice_options),
    correctChoiceKey: contentRow?.choice_correct_key
      ? String(contentRow.choice_correct_key)
      : challengeRow.choice_correct_key
        ? String(challengeRow.choice_correct_key)
        : null,
    choiceExplanationMdx: String(contentRow?.choice_explanation_mdx ?? challengeRow.choice_explanation_mdx ?? ""),
    published
  }
}

/**
 * Resolves the active content version for each stable challenge row while
 * keeping version-selection rules hidden behind the same `Challenge` model the
 * rest of the app already understands.
 */
export function mapChallengesFromRows(
  challengeRows: Record<string, unknown>[],
  challengeVersionRows: Record<string, unknown>[] | null | undefined,
  mode: ChallengeVersionLoadMode
) {
  const versionById = getVersionLookup(challengeVersionRows)

  return challengeRows.map((challengeRow) =>
    mapChallengeFromContentRows(challengeRow, getActiveChallengeVersionRow(challengeRow, versionById, mode))
  )
}

