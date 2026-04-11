import "server-only"

import {
  getAuthorizedCatalogContext,
  loadStableChallengeRowBySlug,
  loadStableCourseRowBySlug,
  loadStableLessonRowBySlug,
  type AuthorizedCatalogContext
} from "@/lib/admin/catalog-versioning"

type VersionSummary = {
  id: string
  versionNumber: number
  status: string
  createdAt: string | null
  updatedAt: string | null
  publishedAt: string | null
}

type EventSummary = {
  id: string
  eventType: string
  changeSummary: string
  actorEmail: string | null
  createdAt: string | null
  fromVersionId: string | null
  toVersionId: string | null
}

export type CatalogHistorySection = {
  contentType: "course" | "lesson" | "challenge"
  title: string
  slug: string
  visible: boolean
  publishedVersionId: string | null
  draftVersionId: string | null
  versions: VersionSummary[]
  events: EventSummary[]
}

export type CatalogHistorySnapshot = {
  sections: CatalogHistorySection[]
}

type CatalogSelection = {
  courseSlug?: string | null
  lessonSlug?: string | null
  challengeSlug?: string | null
}

type AdminClient = AuthorizedCatalogContext["admin"]

async function loadVersionRows(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions",
  foreignKey: "course_id" | "lesson_id" | "challenge_id",
  stableId: string
) {
  const { data, error } = await admin
    .from(tableName)
    .select("id,version_number,status,created_at,updated_at,published_at")
    .eq(foreignKey, stableId)
    .order("version_number", { ascending: false })
    .limit(10)

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return []
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    versionNumber: Number(row.version_number ?? 0),
    status: String(row.status ?? "draft"),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null
  })) satisfies VersionSummary[]
}

async function loadEventRows(
  admin: AdminClient,
  contentType: "course" | "lesson" | "challenge",
  stableId: string
) {
  const { data, error } = await admin
    .from("content_events")
    .select("id,event_type,change_summary,actor_email,created_at,from_version_id,to_version_id")
    .eq("content_type", contentType)
    .eq("content_id", stableId)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "42703" || error?.code === "PGRST204") {
    return []
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type ?? ""),
    changeSummary: String(row.change_summary ?? ""),
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    fromVersionId: row.from_version_id ? String(row.from_version_id) : null,
    toVersionId: row.to_version_id ? String(row.to_version_id) : null
  })) satisfies EventSummary[]
}

/**
 * Loads recent versions and audit events for the currently selected course,
 * chapter, and assignment so the admin page can expose restore targets without
 * leaking table details into the UI.
 */
export async function getAdminCatalogHistorySnapshot(
  selection: CatalogSelection | null
): Promise<CatalogHistorySnapshot> {
  if (!selection?.courseSlug) {
    return { sections: [] }
  }

  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return { sections: [] }
  }

  const { admin } = authorized.context
  const sections: CatalogHistorySection[] = []
  const course = await loadStableCourseRowBySlug(admin, selection.courseSlug)

  if (!course.data) {
    return { sections: [] }
  }

  sections.push({
    contentType: "course",
    title: course.data.title,
    slug: course.data.slug,
    visible: course.data.published,
    publishedVersionId: course.data.currentPublishedVersionId,
    draftVersionId: course.data.currentDraftVersionId,
    versions: await loadVersionRows(admin, "course_versions", "course_id", course.data.id),
    events: await loadEventRows(admin, "course", course.data.id)
  })

  if (!selection.lessonSlug) {
    return { sections }
  }

  const lesson = await loadStableLessonRowBySlug(admin, course.data.id, selection.lessonSlug)
  if (!lesson.data) {
    return { sections }
  }

  sections.push({
    contentType: "lesson",
    title: lesson.data.title,
    slug: lesson.data.slug,
    visible: lesson.data.published,
    publishedVersionId: lesson.data.currentPublishedVersionId,
    draftVersionId: lesson.data.currentDraftVersionId,
    versions: await loadVersionRows(admin, "lesson_versions", "lesson_id", lesson.data.id),
    events: await loadEventRows(admin, "lesson", lesson.data.id)
  })

  if (!selection.challengeSlug) {
    return { sections }
  }

  const challenge = await loadStableChallengeRowBySlug(admin, selection.challengeSlug)
  if (!challenge.data) {
    return { sections }
  }

  sections.push({
    contentType: "challenge",
    title: challenge.data.title,
    slug: challenge.data.slug,
    visible: challenge.data.published,
    publishedVersionId: challenge.data.currentPublishedVersionId,
    draftVersionId: challenge.data.currentDraftVersionId,
    versions: await loadVersionRows(admin, "challenge_versions", "challenge_id", challenge.data.id),
    events: await loadEventRows(admin, "challenge", challenge.data.id)
  })

  return { sections }
}
