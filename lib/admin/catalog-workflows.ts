import "server-only"

import {
  type ImportedChallengeManifest,
  type ImportedCourseManifest,
  type ImportedLessonManifest,
  parseCatalogImportSource
} from "@/lib/admin/catalog-import"
import { deriveCatalogChallengeTitle, deriveCatalogLessonSummary } from "@/lib/admin/catalog-copy"
import {
  type ChallengeVersionInput,
  type AuthorizedCatalogContext,
  buildLocalLabStorageFields,
  getAuthorizedCatalogContext,
  loadStableChallengeRowBySlug,
  loadStableCourseRowBySlug,
  loadStableLessonRowBySlug,
  recordContentEvent,
  saveChallengeVersion,
  saveCourseVersion,
  saveLessonVersion,
  type AdminCatalogOperationResult
} from "@/lib/admin/catalog-versioning"
import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { parseLocalLabManifestSource } from "@/lib/local-labs"
import type { ChallengeKind, CodeChallengeLanguage } from "@/lib/types"
import { slugify } from "@/lib/utils"

type AdminClient = AuthorizedCatalogContext["admin"]

type LessonChallengeRelation = {
  lessonId: string
  challengeId: string
  orderIndex: number
}

type Direction = "up" | "down"
export type CatalogImportDestination =
  | {
      scope: "new_course"
      courseSlug?: null
      lessonSlug?: null
    }
  | {
      scope: "existing_course"
      courseSlug: string
      lessonSlug?: null
    }
  | {
      scope: "existing_lesson"
      courseSlug: string
      lessonSlug: string
    }

type CatalogImportSelection = {
  courseSlug: string
  lessonSlug?: string
  challengeSlug?: string
}

type CatalogImportOperationResult = AdminCatalogOperationResult & {
  selection?: CatalogImportSelection
}

function buildSuccess(message: string): AdminCatalogOperationResult {
  return { success: true, message }
}

function buildFailure(message: string): AdminCatalogOperationResult {
  return { success: false, message }
}

async function getCourseRowBySlug(admin: AdminClient, courseSlug: string) {
  const { data, error } = await admin
    .from("courses")
    .select("id,slug,title,published,current_published_version_id,current_draft_version_id")
    .eq("slug", courseSlug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function getLessonRowBySlug(admin: AdminClient, courseId: string, lessonSlug: string) {
  const { data, error } = await admin
    .from("lessons")
    .select("id,course_id,slug,title,order_index,challenge_slug,published,current_published_version_id,current_draft_version_id")
    .eq("course_id", courseId)
    .eq("slug", lessonSlug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function getChallengeRowBySlug(admin: AdminClient, challengeSlug: string) {
  const { data, error } = await admin
    .from("challenges")
    .select("id,slug,title,published,current_published_version_id,current_draft_version_id")
    .eq("slug", challengeSlug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function loadOptionalLessonChallengeRows(admin: AdminClient, lessonId: string) {
  const { data, error } = await admin
    .from("lesson_challenges")
    .select("lesson_id,challenge_id,order_index")
    .eq("lesson_id", lessonId)
    .order("order_index")

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return null
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    lessonId: String(row.lesson_id),
    challengeId: String(row.challenge_id),
    orderIndex: Number(row.order_index ?? 1)
  })) satisfies LessonChallengeRelation[]
}

async function attachChallengeToLesson(
  admin: AdminClient,
  lessonId: string,
  challengeId: string,
  orderIndex: number | null = null,
  challengeSlug: string | null = null
) {
  const relationRows = await loadOptionalLessonChallengeRows(admin, lessonId)

  if (!relationRows) {
    if (!challengeSlug) {
      throw new Error("Legacy lesson assignment links need a challenge slug.")
    }

    const { error } = await admin
      .from("lessons")
      .update({ challenge_slug: challengeSlug })
      .eq("id", lessonId)

    if (error && error.code !== "42703") {
      throw new Error(error.message)
    }

    return { tableAvailable: false }
  }

  const nextOrderIndex = orderIndex ?? relationRows.length + 1
  const { error } = await admin.from("lesson_challenges").insert({
    lesson_id: lessonId,
    challenge_id: challengeId,
    order_index: nextOrderIndex
  })

  if (error) {
    throw new Error(error.message)
  }

  return { tableAvailable: true }
}

async function loadActiveVersionRow(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions",
  stableRow: { current_draft_version_id?: string | null; current_published_version_id?: string | null }
) {
  const versionId = stableRow.current_draft_version_id ?? stableRow.current_published_version_id ?? null
  if (!versionId) {
    return null
  }

  const { data, error } = await admin.from(tableName).select("*").eq("id", versionId).maybeSingle()

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return null
  }

  if (error) {
    throw new Error(error.message)
  }

  return data as Record<string, unknown> | null
}

async function resolveUniqueSlug(
  admin: AdminClient,
  tableName: "courses" | "lessons" | "challenges",
  baseSlug: string,
  extraFilter?: { column: string; value: string }
) {
  const normalizedBaseSlug = slugify(baseSlug) || "item"
  let nextSlug = normalizedBaseSlug
  let suffix = 2

  while (true) {
    let query = admin.from(tableName).select("id").eq("slug", nextSlug)
    if (extraFilter) {
      query = query.eq(extraFilter.column, extraFilter.value)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return nextSlug
    }

    nextSlug = `${normalizedBaseSlug}-${suffix}`
    suffix += 1
  }
}

async function resolveLessonNextOrderIndex(admin: AdminClient, courseId: string) {
  const { count, error } = await admin
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)

  if (error) {
    throw new Error(error.message)
  }

  return (count ?? 0) + 1
}

async function resolveChallengeNextOrderIndex(admin: AdminClient, lessonId: string) {
  const relationRows = await loadOptionalLessonChallengeRows(admin, lessonId)
  return (relationRows?.length ?? 0) + 1
}

function moveRowIndex(currentIndex: number, direction: Direction, rowCount: number) {
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (targetIndex < 0 || targetIndex >= rowCount) {
    return null
  }

  return targetIndex
}

function reorderRows<T>(rows: T[], currentIndex: number, targetIndex: number) {
  const nextRows = [...rows]
  const [movedRow] = nextRows.splice(currentIndex, 1)

  if (!movedRow) {
    return rows
  }

  nextRows.splice(targetIndex, 0, movedRow)
  return nextRows
}

/**
 * Persists a normalized lesson order so the UI never has to care about how
 * storage handles swaps or duplicate order indexes.
 */
async function persistLessonOrder(admin: AdminClient, lessonRows: Array<{ id: string; orderIndex: number }>) {
  const changedRows = lessonRows.filter((row, index) => row.orderIndex !== index + 1)
  if (!changedRows.length) {
    return
  }

  const now = new Date().toISOString()
  for (const [index, row] of lessonRows.entries()) {
    if (row.orderIndex === index + 1) {
      continue
    }

    const { error } = await admin
      .from("lessons")
      .update({
        order_index: index + 1,
        updated_at: now
      })
      .eq("id", row.id)

    if (error) {
      throw new Error(error.message)
    }
  }
}

/**
 * Reindexes one lesson's assignment relations in two phases so the
 * `(lesson_id, order_index)` uniqueness rule cannot block visible reordering.
 */
async function persistLessonChallengeOrder(admin: AdminClient, lessonId: string, relations: LessonChallengeRelation[]) {
  const changedRelations = relations.filter((relation, index) => relation.orderIndex !== index + 1)
  if (!changedRelations.length) {
    return
  }

  for (const [index, relation] of changedRelations.entries()) {
    const temporaryOrderIndex = -1 * (index + 1)
    const { error } = await admin
      .from("lesson_challenges")
      .update({ order_index: temporaryOrderIndex })
      .eq("lesson_id", lessonId)
      .eq("challenge_id", relation.challengeId)

    if (error) {
      throw new Error(error.message)
    }
  }

  for (const [index, relation] of relations.entries()) {
    const nextOrderIndex = index + 1

    if (relation.orderIndex === nextOrderIndex) {
      continue
    }

    const { error } = await admin
      .from("lesson_challenges")
      .update({ order_index: nextOrderIndex })
      .eq("lesson_id", lessonId)
      .eq("challenge_id", relation.challengeId)

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function setCourseVisibilityForCurrentUser(
  courseSlug: string,
  nextVisible: boolean
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const { error } = await admin
    .from("courses")
    .update({ published: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", course.id)

  if (error) {
    return buildFailure(error.message)
  }

  await recordContentEvent(admin, {
    contentType: "course",
    contentId: String(course.id),
    eventType: nextVisible ? "restore" : "hide",
    changeSummary: nextVisible ? "Restored the course to the learner catalog." : "Hid the course from the learner catalog.",
    actorId: userId,
    actorEmail,
    metadata: { slug: courseSlug }
  })

  return buildSuccess(nextVisible ? "Course restored to the learner catalog." : "Course hidden from the learner catalog.")
}

export async function setLessonVisibilityForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  nextVisible: boolean
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const lesson = await getLessonRowBySlug(admin, String(course.id), lessonSlug)
  if (!lesson) {
    return buildFailure("Chapter not found.")
  }

  const { error } = await admin
    .from("lessons")
    .update({ published: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", lesson.id)

  if (error) {
    return buildFailure(error.message)
  }

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: String(lesson.id),
    eventType: nextVisible ? "restore" : "hide",
    changeSummary: nextVisible ? "Restored the chapter to learners." : "Hid the chapter from learners.",
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonSlug }
  })

  return buildSuccess(nextVisible ? "Chapter restored to the learner course page." : "Chapter hidden from learners.")
}

export async function setChallengeVisibilityForCurrentUser(
  challengeSlug: string,
  nextVisible: boolean
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const challenge = await getChallengeRowBySlug(admin, challengeSlug)
  if (!challenge) {
    return buildFailure("Assignment not found.")
  }

  const { error } = await admin
    .from("challenges")
    .update({ published: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", challenge.id)

  if (error) {
    return buildFailure(error.message)
  }

  await recordContentEvent(admin, {
    contentType: "challenge",
    contentId: String(challenge.id),
    eventType: nextVisible ? "restore" : "hide",
    changeSummary: nextVisible ? "Restored the assignment to learners." : "Hid the assignment from learners.",
    actorId: userId,
    actorEmail,
    metadata: { challengeSlug }
  })

  return buildSuccess(nextVisible ? "Assignment restored to the learner chapter." : "Assignment archived from the learner chapter.")
}

export async function setCourseTreeVisibilityForCurrentUser(
  courseSlug: string,
  nextVisible: boolean
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const { data: lessonRows, error: lessonError } = await admin
    .from("lessons")
    .select("id")
    .eq("course_id", course.id)

  if (lessonError) {
    return buildFailure(lessonError.message)
  }

  const lessonIds = (lessonRows ?? []).map((row) => String(row.id))
  const { error: courseError } = await admin
    .from("courses")
    .update({ published: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", course.id)

  if (courseError) {
    return buildFailure(courseError.message)
  }

  if (lessonIds.length) {
    const { error: lessonUpdateError } = await admin
      .from("lessons")
      .update({ published: nextVisible, updated_at: new Date().toISOString() })
      .in("id", lessonIds)

    if (lessonUpdateError) {
      return buildFailure(lessonUpdateError.message)
    }

    const relationRows = await Promise.all(lessonIds.map((lessonId) => loadOptionalLessonChallengeRows(admin, lessonId)))
    const challengeIds = Array.from(
      new Set(
        relationRows.flatMap((rows) => (rows ?? []).map((row) => row.challengeId))
      )
    )

    if (challengeIds.length) {
      const { error: challengeUpdateError } = await admin
        .from("challenges")
        .update({ published: nextVisible, updated_at: new Date().toISOString() })
        .in("id", challengeIds)

      if (challengeUpdateError) {
        return buildFailure(challengeUpdateError.message)
      }
    }
  }

  await recordContentEvent(admin, {
    contentType: "course",
    contentId: String(course.id),
    eventType: nextVisible ? "batch_publish" : "batch_hide",
    changeSummary: nextVisible ? "Published the course, chapters, and assignments." : "Hid the course, chapters, and assignments.",
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonCount: lessonIds.length }
  })

  return buildSuccess(nextVisible ? "Published the course and all nested content." : "Hid the course and all nested content.")
}

export async function setLessonTreeVisibilityForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  nextVisible: boolean
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const lesson = await getLessonRowBySlug(admin, String(course.id), lessonSlug)
  if (!lesson) {
    return buildFailure("Chapter not found.")
  }

  const { error: lessonError } = await admin
    .from("lessons")
    .update({ published: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", lesson.id)

  if (lessonError) {
    return buildFailure(lessonError.message)
  }

  const relationRows = await loadOptionalLessonChallengeRows(admin, String(lesson.id))
  const challengeIds = Array.from(new Set((relationRows ?? []).map((row) => row.challengeId)))
  if (challengeIds.length) {
    const { error: challengeError } = await admin
      .from("challenges")
      .update({ published: nextVisible, updated_at: new Date().toISOString() })
      .in("id", challengeIds)

    if (challengeError) {
      return buildFailure(challengeError.message)
    }
  }

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: String(lesson.id),
    eventType: nextVisible ? "batch_publish" : "batch_hide",
    changeSummary: nextVisible ? "Published the chapter and its assignments." : "Hid the chapter and its assignments.",
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonSlug, challengeCount: challengeIds.length }
  })

  return buildSuccess(nextVisible ? "Published the chapter and all of its assignments." : "Hid the chapter and all of its assignments.")
}

async function loadVersionById(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions",
  versionId: string
) {
  const { data, error } = await admin.from(tableName).select("*").eq("id", versionId).maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as Record<string, unknown> | null
}

export async function restoreCourseVersionAsDraftForCurrentUser(
  courseSlug: string,
  versionId: string
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const versionRow = await loadVersionById(admin, "course_versions", versionId)
  if (!versionRow || String(versionRow.course_id ?? "") !== String(course.id)) {
    return buildFailure("Course version not found.")
  }

  const restoreResult = await saveCourseVersion(admin, { userId, actorEmail }, {
    slug: courseSlug,
    title: String(versionRow.title ?? course.title),
    summary: String(versionRow.summary ?? ""),
    difficulty: String(versionRow.difficulty ?? "Beginner"),
    accent: String(versionRow.accent ?? "#c96f36"),
    saveMode: "draft"
  })

  await recordContentEvent(admin, {
    contentType: "course",
    contentId: restoreResult.stableRow.id,
    eventType: "restore_version",
    changeSummary: `Restored course version ${String(versionRow.version_number ?? "")} as a new draft.`,
    actorId: userId,
    actorEmail,
    fromVersionId: versionId,
    toVersionId: restoreResult.createdVersionId,
    metadata: { courseSlug, restoredVersionNumber: Number(versionRow.version_number ?? 0) }
  })

  return buildSuccess("Restored the course version as a new draft.")
}

export async function restoreLessonVersionAsDraftForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  versionId: string
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const lesson = await getLessonRowBySlug(admin, String(course.id), lessonSlug)
  if (!lesson) {
    return buildFailure("Chapter not found.")
  }

  const versionRow = await loadVersionById(admin, "lesson_versions", versionId)
  if (!versionRow || String(versionRow.lesson_id ?? "") !== String(lesson.id)) {
    return buildFailure("Chapter version not found.")
  }

  const restoreResult = await saveLessonVersion(admin, { userId, actorEmail }, {
    courseId: String(course.id),
    courseSlug,
    slug: lessonSlug,
    title: String(versionRow.title ?? lesson.title),
    summary: String(versionRow.summary ?? ""),
    estimatedMinutes: Number(versionRow.estimated_minutes ?? 10),
    bodyMdx: String(versionRow.body_mdx ?? ""),
    orderIndex: Number(lesson.order_index ?? 1),
    challengeSlug: lesson.challenge_slug ? String(lesson.challenge_slug) : null,
    saveMode: "draft"
  })

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: restoreResult.stableRow.id,
    eventType: "restore_version",
    changeSummary: `Restored chapter version ${String(versionRow.version_number ?? "")} as a new draft.`,
    actorId: userId,
    actorEmail,
    fromVersionId: versionId,
    toVersionId: restoreResult.createdVersionId,
    metadata: { courseSlug, lessonSlug, restoredVersionNumber: Number(versionRow.version_number ?? 0) }
  })

  return buildSuccess("Restored the chapter version as a new draft.")
}

export async function restoreChallengeVersionAsDraftForCurrentUser(
  challengeSlug: string,
  versionId: string
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const challenge = await getChallengeRowBySlug(admin, challengeSlug)
  if (!challenge) {
    return buildFailure("Assignment not found.")
  }

  const versionRow = await loadVersionById(admin, "challenge_versions", versionId)
  if (!versionRow || String(versionRow.challenge_id ?? "") !== String(challenge.id)) {
    return buildFailure("Assignment version not found.")
  }

  const kind = String(versionRow.kind ?? "code") as ChallengeKind
  const restoreResult = await saveChallengeVersion(admin, { userId, actorEmail }, {
    slug: challengeSlug,
    title: String(versionRow.title ?? challenge.title),
    kind,
    language: versionRow.language ? (String(versionRow.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof versionRow.judge0_language_id === "number" ? versionRow.judge0_language_id : null,
    readingMdx: versionRow.reading_mdx ? String(versionRow.reading_mdx) : null,
    promptMdx: String(versionRow.prompt_mdx ?? ""),
    storageFields: {
      starterCode: String(versionRow.starter_code ?? ""),
      solutionCode: String(versionRow.solution_code ?? ""),
      hiddenTestCode: String(versionRow.hidden_test_code ?? "")
    },
    choiceOptions: normalizeMultipleChoiceOptions(versionRow.choice_options),
    correctChoiceKey: versionRow.choice_correct_key ? String(versionRow.choice_correct_key) : null,
    choiceExplanationMdx: String(versionRow.choice_explanation_mdx ?? ""),
    saveMode: "draft"
  })

  await recordContentEvent(admin, {
    contentType: "challenge",
    contentId: restoreResult.stableRow.id,
    eventType: "restore_version",
    changeSummary: `Restored assignment version ${String(versionRow.version_number ?? "")} as a new draft.`,
    actorId: userId,
    actorEmail,
    fromVersionId: versionId,
    toVersionId: restoreResult.createdVersionId,
    metadata: { challengeSlug, restoredVersionNumber: Number(versionRow.version_number ?? 0) }
  })

  return buildSuccess("Restored the assignment version as a new draft.")
}

async function buildDuplicatedChallengeInput(
  admin: AdminClient,
  challengeSlug: string,
  nextSlug: string
): Promise<ChallengeVersionInput> {
  const stableChallenge = await loadStableChallengeRowBySlug(admin, challengeSlug)
  if (stableChallenge.error) {
    throw new Error(stableChallenge.error.message)
  }

  if (!stableChallenge.data) {
    throw new Error("Assignment not found.")
  }

  const activeVersion = await loadActiveVersionRow(admin, "challenge_versions", {
    current_draft_version_id: stableChallenge.data.currentDraftVersionId,
    current_published_version_id: stableChallenge.data.currentPublishedVersionId
  })

  const sourceRow = activeVersion ?? {
    title: stableChallenge.data.title,
    kind: stableChallenge.data.kind,
    language: stableChallenge.data.language,
    judge0_language_id: stableChallenge.data.judge0LanguageId,
    reading_mdx: stableChallenge.data.readingMdx,
    prompt_mdx: stableChallenge.data.promptMdx,
    starter_code: stableChallenge.data.starterCode,
    solution_code: stableChallenge.data.solutionCode,
    hidden_test_code: stableChallenge.data.hiddenTestCode,
    choice_options: stableChallenge.data.choiceOptions,
    choice_correct_key: stableChallenge.data.correctChoiceKey,
    choice_explanation_mdx: stableChallenge.data.choiceExplanationMdx
  }

  return {
    slug: nextSlug,
    title: `${String(sourceRow.title ?? stableChallenge.data.title)} copy`,
    kind: String(sourceRow.kind ?? stableChallenge.data.kind) as ChallengeKind,
    language: sourceRow.language ? (String(sourceRow.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof sourceRow.judge0_language_id === "number" ? sourceRow.judge0_language_id : null,
    readingMdx: sourceRow.reading_mdx ? String(sourceRow.reading_mdx) : null,
    promptMdx: String(sourceRow.prompt_mdx ?? ""),
    storageFields: {
      starterCode: String(sourceRow.starter_code ?? ""),
      solutionCode: String(sourceRow.solution_code ?? ""),
      hiddenTestCode: String(sourceRow.hidden_test_code ?? "")
    },
    choiceOptions: normalizeMultipleChoiceOptions(sourceRow.choice_options),
    correctChoiceKey: sourceRow.choice_correct_key ? String(sourceRow.choice_correct_key) : null,
    choiceExplanationMdx: String(sourceRow.choice_explanation_mdx ?? ""),
    saveMode: "draft" as const
  }
}

export async function duplicateChallengeForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  challengeSlug: string
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const lesson = await getLessonRowBySlug(admin, String(course.id), lessonSlug)
  if (!lesson) {
    return buildFailure("Chapter not found.")
  }

  const nextSlug = await resolveUniqueSlug(admin, "challenges", `${challengeSlug}-copy`)
  const nextOrderIndex = (await loadOptionalLessonChallengeRows(admin, String(lesson.id)))?.length ?? 0
  const duplicatedInput = await buildDuplicatedChallengeInput(admin, challengeSlug, nextSlug)
  const duplicatedChallenge = await saveChallengeVersion(admin, { userId, actorEmail }, duplicatedInput)
  await attachChallengeToLesson(admin, String(lesson.id), duplicatedChallenge.stableRow.id, nextOrderIndex + 1, nextSlug)

  await recordContentEvent(admin, {
    contentType: "challenge",
    contentId: duplicatedChallenge.stableRow.id,
    eventType: "duplicate",
    changeSummary: "Duplicated the assignment into a new draft.",
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonSlug, sourceChallengeSlug: challengeSlug, duplicatedChallengeSlug: nextSlug }
  })

  return buildSuccess("Duplicated the assignment as a new draft.")
}

export async function moveLessonForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  direction: Direction
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const { data: lessons, error } = await admin
    .from("lessons")
    .select("id,slug,order_index")
    .eq("course_id", course.id)
    .order("order_index")

  if (error) {
    return buildFailure(error.message)
  }

  const lessonRows = (lessons ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    orderIndex: Number(row.order_index ?? 1)
  }))
  const currentIndex = lessonRows.findIndex((row) => row.slug === lessonSlug)
  if (currentIndex < 0) {
    return buildFailure("Chapter not found.")
  }

  const targetIndex = moveRowIndex(currentIndex, direction, lessonRows.length)
  if (targetIndex === null) {
    return buildFailure("That chapter cannot move further.")
  }

  const currentRow = lessonRows[currentIndex]

  try {
    await persistLessonOrder(admin, reorderRows(lessonRows, currentIndex, targetIndex))
  } catch (error) {
    return buildFailure(error instanceof Error ? error.message : "Unable to move the chapter.")
  }

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: currentRow.id,
    eventType: "reorder",
    changeSummary: `Moved the chapter ${direction}.`,
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonSlug, direction }
  })

  return buildSuccess(`Moved the chapter ${direction}.`)
}

export async function moveChallengeForCurrentUser(
  courseSlug: string,
  lessonSlug: string,
  challengeSlug: string,
  direction: Direction
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  const { admin, userId, actorEmail } = authorized.context
  const course = await getCourseRowBySlug(admin, courseSlug)
  if (!course) {
    return buildFailure("Course not found.")
  }

  const lesson = await getLessonRowBySlug(admin, String(course.id), lessonSlug)
  if (!lesson) {
    return buildFailure("Chapter not found.")
  }

  const challenge = await getChallengeRowBySlug(admin, challengeSlug)
  if (!challenge) {
    return buildFailure("Assignment not found.")
  }

  const relations = await loadOptionalLessonChallengeRows(admin, String(lesson.id))
  if (!relations) {
    return buildFailure("Assignment reordering needs the lesson_challenges migration.")
  }

  const currentIndex = relations.findIndex((row) => row.challengeId === String(challenge.id))
  if (currentIndex < 0) {
    return buildFailure("Assignment not found in this chapter.")
  }

  const targetIndex = moveRowIndex(currentIndex, direction, relations.length)
  if (targetIndex === null) {
    return buildFailure("That assignment cannot move further.")
  }

  try {
    await persistLessonChallengeOrder(admin, String(lesson.id), reorderRows(relations, currentIndex, targetIndex))
  } catch (error) {
    return buildFailure(error instanceof Error ? error.message : "Unable to move the assignment.")
  }

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: String(lesson.id),
    eventType: "reorder",
    changeSummary: `Moved an assignment ${direction} inside the chapter.`,
    actorId: userId,
    actorEmail,
    metadata: { courseSlug, lessonSlug, challengeSlug, direction }
  })

  return buildSuccess(`Moved the assignment ${direction}.`)
}

async function importChallengeIntoLesson(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  lessonId: string,
  lessonSlug: string,
  manifest: ImportedChallengeManifest,
  orderIndex: number,
  saveMode: "draft" | "publish"
) {
  if (manifest.kind === "local_lab" && manifest.hiddenTestCode) {
    const parsedManifest = parseLocalLabManifestSource(manifest.hiddenTestCode)
    if (!parsedManifest.success) {
      throw new Error(parsedManifest.message)
    }
  }

  const nextSlug = await resolveUniqueSlug(admin, "challenges", manifest.slug ?? `${lessonSlug}-assignment`)
  const choiceOptions = normalizeMultipleChoiceOptions(manifest.choiceOptions ?? [])
  const challengeResult = await saveChallengeVersion(admin, actor, {
    slug: nextSlug,
    title: manifest.title?.trim() || deriveCatalogChallengeTitle(manifest.promptMdx),
    kind: manifest.kind,
    language: manifest.language ? (String(manifest.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof manifest.judge0LanguageId === "number" ? manifest.judge0LanguageId : null,
    readingMdx: manifest.readingMdx?.trim() || null,
    promptMdx: manifest.promptMdx,
    storageFields:
      manifest.kind === "local_lab"
        ? buildLocalLabStorageFields({
            submitCommandTemplate: manifest.starterCode ?? "",
            solutionNotes: manifest.solutionCode ?? "",
            manifestSource: manifest.hiddenTestCode ?? ""
          })
        : {
            starterCode: manifest.starterCode ?? "",
            solutionCode: manifest.solutionCode ?? "",
            hiddenTestCode: manifest.hiddenTestCode ?? ""
          },
    choiceOptions,
    correctChoiceKey: manifest.correctChoiceKey ?? choiceOptions[0]?.key ?? null,
    choiceExplanationMdx: manifest.choiceExplanationMdx ?? "",
    saveMode
  })

  await attachChallengeToLesson(admin, lessonId, challengeResult.stableRow.id, orderIndex, nextSlug)

  return {
    challengeId: challengeResult.stableRow.id,
    challengeSlug: nextSlug
  }
}

async function importLessonIntoCourse(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  courseId: string,
  courseSlug: string,
  manifest: ImportedLessonManifest,
  lessonOrderIndex: number,
  saveMode: "draft" | "publish"
) {
  const nextLessonSlug = await resolveUniqueSlug(admin, "lessons", manifest.slug ?? manifest.title, {
    column: "course_id",
    value: courseId
  })

  const lessonResult = await saveLessonVersion(admin, actor, {
    courseId,
    courseSlug,
    slug: nextLessonSlug,
    title: manifest.title,
    summary: deriveCatalogLessonSummary(manifest.bodyMdx ?? "", manifest.title, manifest.summary),
    estimatedMinutes: manifest.estimatedMinutes ?? 10,
    bodyMdx: manifest.bodyMdx ?? "",
    orderIndex: lessonOrderIndex,
    challengeSlug: null,
    saveMode
  })

  let firstChallengeSlug: string | null = null

  for (const [challengeIndex, challenge] of manifest.challenges.entries()) {
    const importedChallenge = await importChallengeIntoLesson(
      admin,
      actor,
      lessonResult.stableRow.id,
      nextLessonSlug,
      challenge,
      challengeIndex + 1,
      saveMode
    )

    if (!firstChallengeSlug) {
      firstChallengeSlug = importedChallenge.challengeSlug
    }
  }

  if (firstChallengeSlug) {
    const { error } = await admin
      .from("lessons")
      .update({ challenge_slug: firstChallengeSlug, updated_at: new Date().toISOString() })
      .eq("id", lessonResult.stableRow.id)

    if (error && error.code !== "42703") {
      throw new Error(error.message)
    }
  }

  return {
    lessonId: lessonResult.stableRow.id,
    lessonSlug: nextLessonSlug,
    firstChallengeSlug
  }
}

function mergeLessonBodyIntoChallengeReadings(lesson: ImportedLessonManifest): ImportedChallengeManifest[] {
  const sharedReading = lesson.bodyMdx?.trim() ?? ""

  return lesson.challenges.map((challenge) => {
    if (!sharedReading) {
      return challenge
    }

    const assignmentReading = challenge.readingMdx?.trim() ?? ""
    const mergedReading = [sharedReading, assignmentReading].filter(Boolean).join("\n\n")

    return {
      ...challenge,
      readingMdx: mergedReading
    }
  })
}

async function importChallengesIntoExistingLesson(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  lessonId: string,
  lessonSlug: string,
  manifests: ImportedCourseManifest[],
  saveMode: "draft" | "publish"
) {
  let nextOrderIndex = await resolveChallengeNextOrderIndex(admin, lessonId)
  let importedChallengeCount = 0
  let lastChallengeSlug: string | null = null

  for (const courseManifest of manifests) {
    for (const lessonManifest of courseManifest.lessons) {
      const mergedChallenges = mergeLessonBodyIntoChallengeReadings(lessonManifest)

      for (const challengeManifest of mergedChallenges) {
        const importedChallenge = await importChallengeIntoLesson(
          admin,
          actor,
          lessonId,
          lessonSlug,
          challengeManifest,
          nextOrderIndex,
          saveMode
        )
        nextOrderIndex += 1
        importedChallengeCount += 1
        lastChallengeSlug = importedChallenge.challengeSlug
      }
    }
  }

  return {
    importedChallengeCount,
    lastChallengeSlug
  }
}

async function importLessonsIntoExistingCourse(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  courseId: string,
  courseSlug: string,
  manifests: ImportedCourseManifest[],
  saveMode: "draft" | "publish"
) {
  let nextLessonOrderIndex = await resolveLessonNextOrderIndex(admin, courseId)
  let importedLessonCount = 0
  let lastImportedLessonSlug: string | null = null
  let lastImportedChallengeSlug: string | null = null

  for (const courseManifest of manifests) {
    for (const lessonManifest of courseManifest.lessons) {
      const importedLesson = await importLessonIntoCourse(
        admin,
        actor,
        courseId,
        courseSlug,
        lessonManifest,
        nextLessonOrderIndex,
        saveMode
      )
      nextLessonOrderIndex += 1
      importedLessonCount += 1
      lastImportedLessonSlug = importedLesson.lessonSlug
      lastImportedChallengeSlug = importedLesson.firstChallengeSlug ?? lastImportedChallengeSlug
    }
  }

  return {
    importedLessonCount,
    lastImportedLessonSlug,
    lastImportedChallengeSlug
  }
}

async function importCourses(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  manifests: ImportedCourseManifest[],
  saveMode: "draft" | "publish"
) {
  const importedCourseSlugs: string[] = []
  let lastSelection: CatalogImportSelection | null = null

  for (const manifest of manifests) {
    const nextCourseSlug = await resolveUniqueSlug(admin, "courses", manifest.slug ?? manifest.title)
    const courseResult = await saveCourseVersion(admin, actor, {
      slug: nextCourseSlug,
      title: manifest.title,
      summary: manifest.summary?.trim() || `A practical path into software with ${manifest.title.toLowerCase()}.`,
      difficulty: manifest.difficulty?.trim() || "Beginner",
      accent: manifest.accent?.trim() || "#c96f36",
      saveMode
    })

    const nextCourseId = courseResult.stableRow.id
    for (const [lessonIndex, lesson] of manifest.lessons.entries()) {
      const importedLesson = await importLessonIntoCourse(admin, actor, nextCourseId, nextCourseSlug, lesson, lessonIndex + 1, saveMode)
      lastSelection = {
        courseSlug: nextCourseSlug,
        lessonSlug: importedLesson.lessonSlug,
        challengeSlug: importedLesson.firstChallengeSlug ?? undefined
      }
    }

    await recordContentEvent(admin, {
      contentType: "course",
      contentId: nextCourseId,
      eventType: "bulk_import",
      changeSummary: "Imported course content from a manifest.",
      actorId: actor.userId,
      actorEmail: actor.actorEmail,
      metadata: { courseSlug: nextCourseSlug, lessonCount: manifest.lessons.length, saveMode }
    })

    importedCourseSlugs.push(nextCourseSlug)
  }

  return {
    importedCourseSlugs,
    lastSelection
  }
}

async function importCatalogIntoDestination(
  admin: AdminClient,
  actor: { userId: string; actorEmail: string | null },
  manifests: ImportedCourseManifest[],
  saveMode: "draft" | "publish",
  destination: CatalogImportDestination
) {
  if (destination.scope === "new_course") {
    const { importedCourseSlugs, lastSelection } = await importCourses(admin, actor, manifests, saveMode)
    return {
      importedCourseSlugs,
      selection: lastSelection,
      message:
        saveMode === "publish"
          ? `Imported and published ${importedCourseSlugs.length} course${importedCourseSlugs.length === 1 ? "" : "s"}.`
          : `Imported ${importedCourseSlugs.length} course draft${importedCourseSlugs.length === 1 ? "" : "s"}.`
    }
  }

  const targetCourse = await getCourseRowBySlug(admin, destination.courseSlug)
  if (!targetCourse) {
    throw new Error("Target course not found.")
  }

  if (destination.scope === "existing_course") {
    const { importedLessonCount, lastImportedLessonSlug, lastImportedChallengeSlug } = await importLessonsIntoExistingCourse(
      admin,
      actor,
      String(targetCourse.id),
      targetCourse.slug,
      manifests,
      saveMode
    )

    await recordContentEvent(admin, {
      contentType: "course",
      contentId: String(targetCourse.id),
      eventType: "bulk_import",
      changeSummary: "Imported lesson content into an existing course.",
      actorId: actor.userId,
      actorEmail: actor.actorEmail,
      metadata: {
        courseSlug: targetCourse.slug,
        importedLessonCount,
        saveMode,
        mode: "existing_course"
      }
    })

    return {
      importedCourseSlugs: [targetCourse.slug],
      selection: {
        courseSlug: targetCourse.slug,
        lessonSlug: lastImportedLessonSlug ?? undefined,
        challengeSlug: lastImportedChallengeSlug ?? undefined
      },
      message:
        saveMode === "publish"
          ? `Imported and published ${importedLessonCount} chapter${importedLessonCount === 1 ? "" : "s"} into ${targetCourse.title}.`
          : `Imported ${importedLessonCount} chapter draft${importedLessonCount === 1 ? "" : "s"} into ${targetCourse.title}.`
    }
  }

  const targetLesson = await getLessonRowBySlug(admin, String(targetCourse.id), destination.lessonSlug)
  if (!targetLesson) {
    throw new Error("Target chapter not found.")
  }

  const { importedChallengeCount, lastChallengeSlug } = await importChallengesIntoExistingLesson(
    admin,
    actor,
    String(targetLesson.id),
    targetLesson.slug,
    manifests,
    saveMode
  )

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: String(targetLesson.id),
    eventType: "bulk_import",
    changeSummary: "Imported assignment content into an existing chapter.",
    actorId: actor.userId,
    actorEmail: actor.actorEmail,
    metadata: {
      courseSlug: targetCourse.slug,
      lessonSlug: targetLesson.slug,
      importedChallengeCount,
      saveMode,
      mode: "existing_lesson"
    }
  })

  return {
    importedCourseSlugs: [targetCourse.slug],
    selection: {
      courseSlug: targetCourse.slug,
      lessonSlug: targetLesson.slug,
      challengeSlug: lastChallengeSlug ?? undefined
    },
    message:
      saveMode === "publish"
        ? `Imported and published ${importedChallengeCount} assignment${importedChallengeCount === 1 ? "" : "s"} into ${targetLesson.title}.`
        : `Imported ${importedChallengeCount} assignment draft${importedChallengeCount === 1 ? "" : "s"} into ${targetLesson.title}.`
  }
}

export async function importCatalogManifestForCurrentUser(
  manifestSource: string,
  saveMode: "draft" | "publish",
  destination: CatalogImportDestination = { scope: "new_course" }
): Promise<CatalogImportOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  try {
    const manifests = parseCatalogImportSource(manifestSource)
    const result = await importCatalogIntoDestination(
      authorized.context.admin,
      {
        userId: authorized.context.userId,
        actorEmail: authorized.context.actorEmail
      },
      manifests,
      saveMode,
      destination
    )
    return {
      success: true,
      message: result.message,
      selection: result.selection ?? undefined
    }
  } catch (error) {
    return buildFailure(error instanceof Error ? error.message : "Manifest import failed.")
  }
}

async function buildChallengeManifestFromExisting(admin: AdminClient, challengeSlug: string): Promise<ImportedChallengeManifest> {
  const stableChallenge = await loadStableChallengeRowBySlug(admin, challengeSlug)
  if (stableChallenge.error) {
    throw new Error(stableChallenge.error.message)
  }

  if (!stableChallenge.data) {
    throw new Error("Assignment not found.")
  }

  const activeVersion = await loadActiveVersionRow(admin, "challenge_versions", {
    current_draft_version_id: stableChallenge.data.currentDraftVersionId,
    current_published_version_id: stableChallenge.data.currentPublishedVersionId
  })

  const sourceRow = activeVersion ?? {
    title: stableChallenge.data.title,
    kind: stableChallenge.data.kind,
    language: stableChallenge.data.language,
    judge0_language_id: stableChallenge.data.judge0LanguageId,
    reading_mdx: stableChallenge.data.readingMdx,
    prompt_mdx: stableChallenge.data.promptMdx,
    starter_code: stableChallenge.data.starterCode,
    solution_code: stableChallenge.data.solutionCode,
    hidden_test_code: stableChallenge.data.hiddenTestCode,
    choice_options: stableChallenge.data.choiceOptions,
    choice_correct_key: stableChallenge.data.correctChoiceKey,
    choice_explanation_mdx: stableChallenge.data.choiceExplanationMdx
  }

  return {
    kind: String(sourceRow.kind ?? "code") as ImportedChallengeManifest["kind"],
    title: `${String(sourceRow.title ?? stableChallenge.data.title)} copy`,
    readingMdx: sourceRow.reading_mdx ? String(sourceRow.reading_mdx) : undefined,
    promptMdx: String(sourceRow.prompt_mdx ?? ""),
    language: sourceRow.language ? (String(sourceRow.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof sourceRow.judge0_language_id === "number" ? sourceRow.judge0_language_id : null,
    starterCode: String(sourceRow.starter_code ?? ""),
    solutionCode: String(sourceRow.solution_code ?? ""),
    hiddenTestCode: String(sourceRow.hidden_test_code ?? ""),
    choiceOptions: normalizeMultipleChoiceOptions(sourceRow.choice_options),
    correctChoiceKey: sourceRow.choice_correct_key ? String(sourceRow.choice_correct_key) : null,
    choiceExplanationMdx: String(sourceRow.choice_explanation_mdx ?? "")
  }
}

async function buildLessonManifestFromExisting(
  admin: AdminClient,
  courseId: string,
  lessonSlug: string
): Promise<ImportedLessonManifest> {
  const stableLesson = await loadStableLessonRowBySlug(admin, courseId, lessonSlug)
  if (stableLesson.error) {
    throw new Error(stableLesson.error.message)
  }

  if (!stableLesson.data) {
    throw new Error("Chapter not found.")
  }

  const activeVersion = await loadActiveVersionRow(admin, "lesson_versions", {
    current_draft_version_id: stableLesson.data.currentDraftVersionId,
    current_published_version_id: stableLesson.data.currentPublishedVersionId
  })

  const relationRows = await loadOptionalLessonChallengeRows(admin, stableLesson.data.id)
  const challengeIds = (relationRows ?? []).map((row) => row.challengeId)
  const challengeRows = challengeIds.length
    ? await admin.from("challenges").select("id,slug").in("id", challengeIds)
    : { data: [] as Array<{ id: string; slug: string }>, error: null }

  if (challengeRows.error) {
    throw new Error(challengeRows.error.message)
  }

  const challengeSlugById = new Map((challengeRows.data ?? []).map((row) => [String(row.id), String(row.slug)]))
  const challengeManifests: ImportedChallengeManifest[] = []
  for (const relation of relationRows ?? []) {
    const challengeSlug = challengeSlugById.get(relation.challengeId)
    if (!challengeSlug) {
      continue
    }

    challengeManifests.push(await buildChallengeManifestFromExisting(admin, challengeSlug))
  }

  return {
    title: `${String(activeVersion?.title ?? stableLesson.data.title)} copy`,
    summary: String(activeVersion?.summary ?? stableLesson.data.summary),
    estimatedMinutes: Number(activeVersion?.estimated_minutes ?? stableLesson.data.estimatedMinutes),
    bodyMdx: String(activeVersion?.body_mdx ?? stableLesson.data.bodyMdx),
    challenges: challengeManifests
  }
}

export async function duplicateLessonForCurrentUser(
  courseSlug: string,
  lessonSlug: string
): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  try {
    const { admin, userId, actorEmail } = authorized.context
    const course = await getCourseRowBySlug(admin, courseSlug)
    if (!course) {
      return buildFailure("Course not found.")
    }

    const lessonManifest = await buildLessonManifestFromExisting(admin, String(course.id), lessonSlug)
    const orderIndex = await resolveLessonNextOrderIndex(admin, String(course.id))
    await importLessonIntoCourse(admin, { userId, actorEmail }, String(course.id), courseSlug, lessonManifest, orderIndex, "draft")

    return buildSuccess("Duplicated the chapter and its assignments as new drafts.")
  } catch (error) {
    return buildFailure(error instanceof Error ? error.message : "Unable to duplicate the chapter.")
  }
}

export async function cloneCourseForCurrentUser(courseSlug: string): Promise<AdminCatalogOperationResult> {
  const authorized = await getAuthorizedCatalogContext()
  if (!authorized.success) {
    return authorized.result
  }

  try {
    const { admin } = authorized.context
    const course = await getCourseRowBySlug(admin, courseSlug)
    if (!course) {
      return buildFailure("Course not found.")
    }

    const activeVersion = await loadActiveVersionRow(admin, "course_versions", {
      current_draft_version_id: course.current_draft_version_id ? String(course.current_draft_version_id) : null,
      current_published_version_id: course.current_published_version_id ? String(course.current_published_version_id) : null
    })

    const { data: lessonRows, error: lessonError } = await admin
      .from("lessons")
      .select("slug")
      .eq("course_id", course.id)
      .order("order_index")

    if (lessonError) {
      throw new Error(lessonError.message)
    }

    const lessonManifests: ImportedLessonManifest[] = []
    for (const lessonRow of lessonRows ?? []) {
      lessonManifests.push(await buildLessonManifestFromExisting(admin, String(course.id), String(lessonRow.slug)))
    }

    const manifest: ImportedCourseManifest = {
      title: `${String(activeVersion?.title ?? course.title)} copy`,
      summary: String(activeVersion?.summary ?? ""),
      difficulty: String(activeVersion?.difficulty ?? "Beginner"),
      accent: String(activeVersion?.accent ?? "#c96f36"),
      lessons: lessonManifests
    }

    await importCourses(
      admin,
      {
        userId: authorized.context.userId,
        actorEmail: authorized.context.actorEmail
      },
      [manifest],
      "draft"
    )

    return buildSuccess("Cloned the course, chapters, and assignments as new drafts.")
  } catch (error) {
    return buildFailure(error instanceof Error ? error.message : "Unable to clone the course.")
  }
}
