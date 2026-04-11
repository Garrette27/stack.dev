import { normalizePublicationState } from "@/lib/challenges/model"
import type { Course, Lesson } from "@/lib/types"

export type CatalogVersionLoadMode = "published" | "draft_or_published"

type StableCatalogRow = Record<string, unknown>
type VersionCatalogRow = Record<string, unknown>

function getVersionLookup(versionRows: VersionCatalogRow[] | null | undefined) {
  return new Map((versionRows ?? []).map((row) => [String(row.id), row]))
}

function getActiveVersionRow(
  stableRow: StableCatalogRow,
  versionById: Map<string, VersionCatalogRow>,
  mode: CatalogVersionLoadMode
) {
  const publishedVersionId = stableRow.current_published_version_id
    ? String(stableRow.current_published_version_id)
    : null
  const draftVersionId = stableRow.current_draft_version_id
    ? String(stableRow.current_draft_version_id)
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

function getStableRowPublicationState(stableRow: StableCatalogRow, versionRow: VersionCatalogRow | null) {
  return normalizePublicationState(versionRow?.status, Boolean(stableRow.published ?? true))
}

/**
 * Resolves course content from version rows when the schema is available while
 * preserving a stable course model for the rest of the app.
 */
export function mapCoursesFromRows(
  courseRows: StableCatalogRow[],
  courseVersionRows: VersionCatalogRow[] | null | undefined,
  mode: CatalogVersionLoadMode
) {
  const versionById = getVersionLookup(courseVersionRows)

  return courseRows.map((courseRow) => {
    const contentRow = getActiveVersionRow(courseRow, versionById, mode)

    return {
      id: String(courseRow.id),
      slug: String(courseRow.slug),
      versionId: contentRow?.id ? String(contentRow.id) : null,
      versionNumber:
        typeof contentRow?.version_number === "number"
          ? contentRow.version_number
          : contentRow?.version_number
            ? Number(contentRow.version_number)
            : null,
      publishedVersionId: courseRow.current_published_version_id ? String(courseRow.current_published_version_id) : null,
      draftVersionId: courseRow.current_draft_version_id ? String(courseRow.current_draft_version_id) : null,
      publicationState: getStableRowPublicationState(courseRow, contentRow),
      title: String(contentRow?.title ?? courseRow.title),
      summary: String(contentRow?.summary ?? courseRow.summary ?? ""),
      difficulty: String(contentRow?.difficulty ?? courseRow.difficulty ?? "Beginner"),
      accent: String(contentRow?.accent ?? courseRow.accent ?? "#c96f36"),
      published: Boolean(courseRow.published ?? true),
      updatedAt: contentRow?.updated_at
        ? String(contentRow.updated_at)
        : courseRow.updated_at
          ? String(courseRow.updated_at)
          : null
    } satisfies Course
  })
}

/**
 * Resolves lesson content from version rows so the rest of the app can keep
 * consuming one stable lesson shape regardless of how lesson history is stored.
 */
export function mapLessonsFromRows(
  lessonRows: StableCatalogRow[],
  lessonVersionRows: VersionCatalogRow[] | null | undefined,
  mode: CatalogVersionLoadMode,
  courseSlugById: Map<string, string>,
  challengeIdsByLessonId: Map<string, string[]>
) {
  const versionById = getVersionLookup(lessonVersionRows)

  return lessonRows.map((lessonRow) => {
    const contentRow = getActiveVersionRow(lessonRow, versionById, mode)

    return {
      id: String(lessonRow.id),
      courseId: String(lessonRow.course_id),
      courseSlug: courseSlugById.get(String(lessonRow.course_id)) ?? "",
      slug: String(lessonRow.slug),
      versionId: contentRow?.id ? String(contentRow.id) : null,
      versionNumber:
        typeof contentRow?.version_number === "number"
          ? contentRow.version_number
          : contentRow?.version_number
            ? Number(contentRow.version_number)
            : null,
      publishedVersionId: lessonRow.current_published_version_id ? String(lessonRow.current_published_version_id) : null,
      draftVersionId: lessonRow.current_draft_version_id ? String(lessonRow.current_draft_version_id) : null,
      publicationState: getStableRowPublicationState(lessonRow, contentRow),
      title: String(contentRow?.title ?? lessonRow.title),
      summary: String(contentRow?.summary ?? lessonRow.summary ?? ""),
      estimatedMinutes: Number(contentRow?.estimated_minutes ?? lessonRow.estimated_minutes ?? 10),
      bodyMdx: String(contentRow?.body_mdx ?? lessonRow.body_mdx ?? ""),
      challengeIds: challengeIdsByLessonId.get(String(lessonRow.id)) ?? [],
      orderIndex: Number(lessonRow.order_index ?? 1),
      published: Boolean(lessonRow.published ?? true),
      updatedAt: contentRow?.updated_at
        ? String(contentRow.updated_at)
        : lessonRow.updated_at
          ? String(lessonRow.updated_at)
          : null
    } satisfies Lesson
  })
}
