import {
  buildChallengeRecord,
  normalizeChallengeKind,
  normalizeChallengePublicationState
} from "@/lib/challenges/model"
import type { Challenge } from "@/lib/types"
import type { CatalogVersionLoadMode } from "./catalog-versions"

export type ChallengeVersionLoadMode = CatalogVersionLoadMode

type ChallengeContentRow = Record<string, unknown>

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
  const kind = normalizeChallengeKind(contentRow?.kind ?? challengeRow.kind)

  return buildChallengeRecord({
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
    publicationState: normalizeChallengePublicationState(contentRow?.status, published),
    kind,
    language:
      contentRow?.language == null && challengeRow.language == null
        ? null
        : String(contentRow?.language ?? challengeRow.language),
    judge0LanguageId:
      typeof contentRow?.judge0_language_id === "number"
        ? contentRow.judge0_language_id
        : typeof challengeRow.judge0_language_id === "number"
          ? challengeRow.judge0_language_id
          : null,
    readingMdx: String(contentRow?.reading_mdx ?? challengeRow.reading_mdx ?? ""),
    promptMdx: String(contentRow?.prompt_mdx ?? challengeRow.prompt_mdx ?? ""),
    starterCode: String(contentRow?.starter_code ?? challengeRow.starter_code ?? ""),
    solutionCode: String(contentRow?.solution_code ?? challengeRow.solution_code ?? ""),
    hiddenTestCode: String(contentRow?.hidden_test_code ?? challengeRow.hidden_test_code ?? ""),
    choiceOptions: contentRow?.choice_options ?? challengeRow.choice_options,
    correctChoiceKey: contentRow?.choice_correct_key
      ? String(contentRow.choice_correct_key)
      : challengeRow.choice_correct_key
        ? String(challengeRow.choice_correct_key)
        : null,
    choiceExplanationMdx: String(contentRow?.choice_explanation_mdx ?? challengeRow.choice_explanation_mdx ?? ""),
    published,
    updatedAt: contentRow?.updated_at
      ? String(contentRow.updated_at)
      : challengeRow.updated_at
        ? String(challengeRow.updated_at)
        : null
  })
}

/**
 * Resolves the active content version for each stable challenge row while
 * keeping version-selection rules hidden behind the same `Challenge` model the
 * rest of the app already understands.
 */
export function mapChallengesFromRows(
  challengeRows: Record<string, unknown>[],
  challengeVersionRows: Record<string, unknown>[] | null | undefined,
  mode: CatalogVersionLoadMode
) {
  const versionById = getVersionLookup(challengeVersionRows)

  return challengeRows.map((challengeRow) =>
    mapChallengeFromContentRows(challengeRow, getActiveChallengeVersionRow(challengeRow, versionById, mode))
  )
}
