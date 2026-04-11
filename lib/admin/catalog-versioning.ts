import "server-only"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { getLocalLabChallengeStorageFields } from "@/lib/local-labs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ChallengeKind, CodeChallengeLanguage, MultipleChoiceOption } from "@/lib/types"

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

export type CatalogEntityType = "course" | "lesson" | "challenge"
export type VersionSaveMode = "draft" | "publish"

export type AdminCatalogOperationResult = {
  success: boolean
  message: string
}

export type AuthorizedCatalogContext = {
  admin: AdminClient
  userId: string
  actorEmail: string | null
}

export type CourseVersionInput = {
  slug: string
  title: string
  summary: string
  difficulty: string
  accent: string
  saveMode: VersionSaveMode
}

export type LessonVersionInput = {
  courseId: string
  courseSlug: string
  slug: string
  title: string
  summary: string
  estimatedMinutes: number
  bodyMdx: string
  orderIndex: number
  challengeSlug: string | null
  saveMode: VersionSaveMode
}

export type ChallengeStorageFields = {
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
}

export type ChallengeVersionInput = {
  slug: string
  title: string
  kind: ChallengeKind
  language: CodeChallengeLanguage | null
  judge0LanguageId: number | null
  readingMdx: string | null
  promptMdx: string
  storageFields: ChallengeStorageFields
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string | null
  choiceExplanationMdx: string
  saveMode: VersionSaveMode
}

export type StableCourseRow = {
  id: string
  slug: string
  title: string
  summary: string
  difficulty: string
  accent: string
  published: boolean
  currentPublishedVersionId: string | null
  currentDraftVersionId: string | null
}

export type StableLessonRow = {
  id: string
  courseId: string
  slug: string
  title: string
  summary: string
  estimatedMinutes: number
  bodyMdx: string
  orderIndex: number
  challengeSlug: string | null
  published: boolean
  currentPublishedVersionId: string | null
  currentDraftVersionId: string | null
}

export type StableChallengeRow = {
  id: string
  slug: string
  title: string
  kind: ChallengeKind
  language: CodeChallengeLanguage | null
  judge0LanguageId: number | null
  readingMdx: string | null
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string | null
  choiceExplanationMdx: string
  published: boolean
  currentPublishedVersionId: string | null
  currentDraftVersionId: string | null
}

type SaveVersionResult<Row> = {
  stableRow: Row
  createdVersionId: string | null
}

type ContentEventInput = {
  contentType: CatalogEntityType
  contentId: string
  eventType: string
  changeSummary: string
  actorId: string | null
  actorEmail: string | null
  fromVersionId?: string | null
  toVersionId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Provides one authenticated admin context for catalog writes so visibility,
 * history, restore, duplication, and import flows all share the same access rules.
 */
export async function getAuthorizedCatalogContext(): Promise<
  | { success: true; context: AuthorizedCatalogContext }
  | { success: false; result: AdminCatalogOperationResult }
> {
  const user = await getCurrentUser()
  const isAdmin = user ? await isCurrentUserAdmin() : false

  if (!user) {
    return {
      success: false,
      result: { success: false, message: "Sign in first." }
    }
  }

  if (!isAdmin) {
    return {
      success: false,
      result: { success: false, message: "This account does not have authoring access." }
    }
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      result: {
        success: false,
        message: "Catalog changes are unavailable until admin access is configured for this project."
      }
    }
  }

  return {
    success: true,
    context: {
      admin: createAdminClient()!,
      userId: user.id,
      actorEmail: user.email ?? null
    }
  }
}

function isMissingRelation(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204"
}

function isMissingCourseVersionSchema(error: { code?: string; message?: string } | null) {
  return isMissingRelation(error) || isMissingColumn(error) || error?.message?.includes("course_versions") === true
}

function isMissingLessonVersionSchema(error: { code?: string; message?: string } | null) {
  return isMissingRelation(error) || isMissingColumn(error) || error?.message?.includes("lesson_versions") === true
}

export function isMissingChallengeVersionSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    isMissingRelation(error) ||
    isMissingColumn(error) ||
    error.message?.includes("challenge_versions") === true ||
    error.message?.includes("current_published_version_id") === true ||
    error.message?.includes("current_draft_version_id") === true
  )
}

function isMissingContentEventSchema(error: { code?: string; message?: string } | null) {
  return isMissingRelation(error) || isMissingColumn(error) || error?.message?.includes("content_events") === true
}

function isMissingReadingColumn(error: { code?: string; message?: string } | null) {
  return isMissingColumn(error) || error?.message?.includes("reading_mdx") === true
}

function isMissingMultipleChoiceColumn(error: { code?: string; message?: string } | null) {
  return (
    isMissingColumn(error) ||
    error?.message?.includes("kind") === true ||
    error?.message?.includes("choice_options") === true ||
    error?.message?.includes("choice_correct_key") === true ||
    error?.message?.includes("choice_explanation_mdx") === true
  )
}

function isMissingChallengeKindColumn(error: { code?: string; message?: string } | null) {
  return isMissingColumn(error) || error?.message?.includes("kind") === true
}

/**
 * Writes append-only audit rows when the table exists and otherwise silently
 * degrades so the app can still operate while the migration is rolling out.
 */
export async function recordContentEvent(
  admin: AdminClient,
  event: ContentEventInput
) {
  const { error } = await admin.from("content_events").insert({
    content_type: event.contentType,
    content_id: event.contentId,
    event_type: event.eventType,
    actor_id: event.actorId,
    actor_email: event.actorEmail,
    change_summary: event.changeSummary,
    from_version_id: event.fromVersionId ?? null,
    to_version_id: event.toVersionId ?? null,
    metadata: event.metadata ?? {}
  })

  if (error && !isMissingContentEventSchema(error)) {
    throw new Error(error.message)
  }
}

async function getNextVersionNumber(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions",
  foreignKey: "course_id" | "lesson_id" | "challenge_id",
  stableId: string
) {
  const { data, error } = await admin
    .from(tableName)
    .select("version_number")
    .eq(foreignKey, stableId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return Number(data?.version_number ?? 0) + 1
}

async function archiveVersion(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions",
  versionId: string | null,
  exceptVersionId: string | null
) {
  if (!versionId || versionId === exceptVersionId) {
    return
  }

  const { error } = await admin
    .from(tableName)
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    })
    .eq("id", versionId)

  if (error) {
    throw new Error(error.message)
  }
}

function buildCourseMirrorRow(input: CourseVersionInput, published: boolean) {
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    accent: input.accent,
    published,
    updated_at: new Date().toISOString()
  }
}

function buildLessonMirrorRow(input: LessonVersionInput, published: boolean) {
  return {
    course_id: input.courseId,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    estimated_minutes: input.estimatedMinutes,
    body_mdx: input.bodyMdx,
    challenge_slug: input.challengeSlug,
    order_index: input.orderIndex,
    published,
    updated_at: new Date().toISOString()
  }
}

function buildChallengeMirrorRow(input: ChallengeVersionInput, published: boolean) {
  return {
    slug: input.slug,
    title: input.title,
    kind: input.kind,
    language: input.language,
    judge0_language_id: input.judge0LanguageId,
    reading_mdx: input.readingMdx,
    prompt_mdx: input.promptMdx,
    starter_code: input.storageFields.starterCode,
    solution_code: input.storageFields.solutionCode,
    hidden_test_code: input.storageFields.hiddenTestCode,
    choice_options: input.kind === "multiple_choice" ? input.choiceOptions : [],
    choice_correct_key: input.kind === "multiple_choice" ? input.correctChoiceKey : null,
    choice_explanation_mdx: input.kind === "multiple_choice" ? input.choiceExplanationMdx : "",
    published,
    updated_at: new Date().toISOString()
  }
}

async function probeTable(
  admin: AdminClient,
  tableName: "course_versions" | "lesson_versions" | "challenge_versions"
) {
  return admin.from(tableName).select("id").limit(1)
}

export async function loadStableCourseRowBySlug(admin: AdminClient, courseSlug: string) {
  const result = await admin
    .from("courses")
    .select("id,slug,title,summary,difficulty,accent,published,current_published_version_id,current_draft_version_id")
    .eq("slug", courseSlug)
    .maybeSingle()

  if (result.error) {
    return { data: null, error: result.error }
  }

  if (!result.data) {
    return { data: null, error: null }
  }

  return {
    data: {
      id: String(result.data.id),
      slug: String(result.data.slug),
      title: String(result.data.title),
      summary: String(result.data.summary ?? ""),
      difficulty: String(result.data.difficulty ?? "Beginner"),
      accent: String(result.data.accent ?? "#c96f36"),
      published: Boolean(result.data.published ?? false),
      currentPublishedVersionId: result.data.current_published_version_id ? String(result.data.current_published_version_id) : null,
      currentDraftVersionId: result.data.current_draft_version_id ? String(result.data.current_draft_version_id) : null
    } satisfies StableCourseRow,
    error: null
  }
}

export async function loadStableLessonRowBySlug(admin: AdminClient, courseId: string, lessonSlug: string) {
  const result = await admin
    .from("lessons")
    .select("id,course_id,slug,title,summary,estimated_minutes,body_mdx,order_index,challenge_slug,published,current_published_version_id,current_draft_version_id")
    .eq("course_id", courseId)
    .eq("slug", lessonSlug)
    .maybeSingle()

  if (result.error) {
    return { data: null, error: result.error }
  }

  if (!result.data) {
    return { data: null, error: null }
  }

  return {
    data: {
      id: String(result.data.id),
      courseId: String(result.data.course_id),
      slug: String(result.data.slug),
      title: String(result.data.title),
      summary: String(result.data.summary ?? ""),
      estimatedMinutes: Number(result.data.estimated_minutes ?? 10),
      bodyMdx: String(result.data.body_mdx ?? ""),
      orderIndex: Number(result.data.order_index ?? 1),
      challengeSlug: result.data.challenge_slug ? String(result.data.challenge_slug) : null,
      published: Boolean(result.data.published ?? false),
      currentPublishedVersionId: result.data.current_published_version_id ? String(result.data.current_published_version_id) : null,
      currentDraftVersionId: result.data.current_draft_version_id ? String(result.data.current_draft_version_id) : null
    } satisfies StableLessonRow,
    error: null
  }
}

export async function loadStableChallengeRowBySlug(admin: AdminClient, challengeSlug: string) {
  const result = await admin
    .from("challenges")
    .select("id,slug,title,kind,language,judge0_language_id,reading_mdx,prompt_mdx,starter_code,solution_code,hidden_test_code,choice_options,choice_correct_key,choice_explanation_mdx,published,current_published_version_id,current_draft_version_id")
    .eq("slug", challengeSlug)
    .maybeSingle()

  if (result.error) {
    return { data: null, error: result.error }
  }

  if (!result.data) {
    return { data: null, error: null }
  }

  return {
    data: {
      id: String(result.data.id),
      slug: String(result.data.slug),
      title: String(result.data.title),
      kind: String(result.data.kind ?? "code") as ChallengeKind,
      language: result.data.language ? (String(result.data.language) as CodeChallengeLanguage) : null,
      judge0LanguageId: typeof result.data.judge0_language_id === "number" ? result.data.judge0_language_id : null,
      readingMdx: result.data.reading_mdx ? String(result.data.reading_mdx) : null,
      promptMdx: String(result.data.prompt_mdx ?? ""),
      starterCode: String(result.data.starter_code ?? ""),
      solutionCode: String(result.data.solution_code ?? ""),
      hiddenTestCode: String(result.data.hidden_test_code ?? ""),
      choiceOptions: Array.isArray(result.data.choice_options)
        ? (result.data.choice_options as MultipleChoiceOption[])
        : [],
      correctChoiceKey: result.data.choice_correct_key ? String(result.data.choice_correct_key) : null,
      choiceExplanationMdx: String(result.data.choice_explanation_mdx ?? ""),
      published: Boolean(result.data.published ?? false),
      currentPublishedVersionId: result.data.current_published_version_id ? String(result.data.current_published_version_id) : null,
      currentDraftVersionId: result.data.current_draft_version_id ? String(result.data.current_draft_version_id) : null
    } satisfies StableChallengeRow,
    error: null
  }
}

async function upsertLegacyCourseRecord(admin: AdminClient, input: CourseVersionInput, published: boolean) {
  return admin
    .from("courses")
    .upsert(buildCourseMirrorRow(input, published), { onConflict: "slug" })
    .select("id,slug,title,summary,difficulty,accent,published")
    .single()
}

async function upsertLegacyLessonRecord(admin: AdminClient, input: LessonVersionInput, published: boolean) {
  return admin
    .from("lessons")
    .upsert(buildLessonMirrorRow(input, published), { onConflict: "course_id,slug" })
    .select("id,course_id,slug,title,summary,estimated_minutes,body_mdx,order_index,challenge_slug,published")
    .single()
}

async function upsertLegacyChallengeRecord(admin: AdminClient, input: ChallengeVersionInput, published: boolean) {
  const fullResult = await admin
    .from("challenges")
    .upsert(buildChallengeMirrorRow(input, published), { onConflict: "slug" })
    .select("id,slug,title,kind,language,judge0_language_id,reading_mdx,prompt_mdx,starter_code,solution_code,hidden_test_code,choice_options,choice_correct_key,choice_explanation_mdx,published")
    .single()

  if (!fullResult.error) {
    return fullResult
  }

  if (input.kind === "multiple_choice" && isMissingMultipleChoiceColumn(fullResult.error)) {
    return {
      data: null,
      error: {
        ...fullResult.error,
        message: "Apply the multiple-choice challenge migration before saving quiz assignments."
      }
    }
  }

  if (input.kind === "local_lab" && isMissingChallengeKindColumn(fullResult.error)) {
    return {
      data: null,
      error: {
        ...fullResult.error,
        message: "Apply the local-lab challenge migration before saving local lab assignments."
      }
    }
  }

  if (
    !isMissingReadingColumn(fullResult.error) &&
    !isMissingMultipleChoiceColumn(fullResult.error) &&
    !isMissingChallengeKindColumn(fullResult.error)
  ) {
    return fullResult
  }

  return admin
    .from("challenges")
    .upsert(
      {
        slug: input.slug,
        title: input.title,
        language: input.kind === "code" ? input.language : null,
        judge0_language_id: input.kind === "code" ? input.judge0LanguageId : null,
        prompt_mdx: input.promptMdx,
        starter_code: input.storageFields.starterCode,
        solution_code: input.storageFields.solutionCode,
        hidden_test_code: input.storageFields.hiddenTestCode,
        published
      },
      {
        onConflict: "slug"
      }
    )
    .select("id,slug,title,language,judge0_language_id,prompt_mdx,starter_code,solution_code,hidden_test_code,published")
    .single()
}

/**
 * Normalizes legacy challenge upsert rows while the catalog is bridging older
 * schemas and the newer versioned shape.
 */
function mapLegacyChallengeRowToStableChallenge(
  row: Record<string, unknown>,
  input: ChallengeVersionInput
): StableChallengeRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    kind: String(row.kind ?? input.kind) as ChallengeKind,
    language: row.language ? (String(row.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof row.judge0_language_id === "number" ? row.judge0_language_id : null,
    readingMdx: row.reading_mdx ? String(row.reading_mdx) : null,
    promptMdx: String(row.prompt_mdx ?? ""),
    starterCode: String(row.starter_code ?? ""),
    solutionCode: String(row.solution_code ?? ""),
    hiddenTestCode: String(row.hidden_test_code ?? ""),
    choiceOptions: Array.isArray(row.choice_options) ? (row.choice_options as MultipleChoiceOption[]) : [],
    correctChoiceKey: row.choice_correct_key ? String(row.choice_correct_key) : null,
    choiceExplanationMdx: String(row.choice_explanation_mdx ?? ""),
    published: Boolean(row.published ?? false),
    currentPublishedVersionId: null,
    currentDraftVersionId: null
  }
}

function getDraftVisibility<T extends { published: boolean }>(stableRow: T | null) {
  return stableRow?.published ?? false
}

/**
 * Persists course content using append-only versions when available while
 * preserving a legacy direct-row fallback during migrations.
 */
export async function saveCourseVersion(
  admin: AdminClient,
  actor: Pick<AuthorizedCatalogContext, "userId" | "actorEmail">,
  input: CourseVersionInput
): Promise<SaveVersionResult<StableCourseRow>> {
  const versionProbe = await probeTable(admin, "course_versions")
  if (versionProbe.error && isMissingCourseVersionSchema(versionProbe.error)) {
    const legacyResult = await upsertLegacyCourseRecord(admin, input, input.saveMode === "publish")
    if (legacyResult.error) {
      throw new Error(legacyResult.error.message)
    }

    return {
      stableRow: {
        id: String(legacyResult.data.id),
        slug: String(legacyResult.data.slug),
        title: String(legacyResult.data.title),
        summary: String(legacyResult.data.summary ?? ""),
        difficulty: String(legacyResult.data.difficulty ?? "Beginner"),
        accent: String(legacyResult.data.accent ?? "#c96f36"),
        published: Boolean(legacyResult.data.published ?? false),
        currentPublishedVersionId: null,
        currentDraftVersionId: null
      },
      createdVersionId: null
    }
  }

  if (versionProbe.error) {
    throw new Error(versionProbe.error.message)
  }

  const existingResult = await loadStableCourseRowBySlug(admin, input.slug)
  if (existingResult.error) {
    throw new Error(existingResult.error.message)
  }

  const existingCourse = existingResult.data
  const mirrorPublishedContent = input.saveMode === "publish" || !existingCourse?.currentPublishedVersionId
  const now = new Date().toISOString()
  const stableResult = await admin
    .from("courses")
    .upsert(
      mirrorPublishedContent
        ? buildCourseMirrorRow(input, input.saveMode === "publish" ? true : Boolean(existingCourse?.currentPublishedVersionId))
        : {
            slug: input.slug,
            title: existingCourse?.title ?? input.title,
            summary: existingCourse?.summary ?? input.summary,
            difficulty: existingCourse?.difficulty ?? input.difficulty,
            accent: existingCourse?.accent ?? input.accent,
            published: getDraftVisibility(existingCourse),
            updated_at: now
          },
      { onConflict: "slug" }
    )
    .select("id,slug,title,summary,difficulty,accent,published,current_published_version_id,current_draft_version_id")
    .single()

  if (stableResult.error) {
    throw new Error(stableResult.error.message)
  }

  const stableRow: StableCourseRow = {
    id: String(stableResult.data.id),
    slug: String(stableResult.data.slug),
    title: String(stableResult.data.title),
    summary: String(stableResult.data.summary ?? ""),
    difficulty: String(stableResult.data.difficulty ?? "Beginner"),
    accent: String(stableResult.data.accent ?? "#c96f36"),
    published: Boolean(stableResult.data.published ?? false),
    currentPublishedVersionId: stableResult.data.current_published_version_id ? String(stableResult.data.current_published_version_id) : null,
    currentDraftVersionId: stableResult.data.current_draft_version_id ? String(stableResult.data.current_draft_version_id) : null
  }

  const nextVersionNumber = await getNextVersionNumber(admin, "course_versions", "course_id", stableRow.id)
  const sourceVersionId = stableRow.currentDraftVersionId ?? stableRow.currentPublishedVersionId
  const versionInsert = await admin
    .from("course_versions")
    .insert({
      course_id: stableRow.id,
      version_number: nextVersionNumber,
      status: input.saveMode === "publish" ? "published" : "draft",
      source_version_id: sourceVersionId,
      title: input.title,
      summary: input.summary,
      difficulty: input.difficulty,
      accent: input.accent,
      created_by: actor.userId,
      published_by: input.saveMode === "publish" ? actor.userId : null,
      published_at: input.saveMode === "publish" ? now : null
    })
    .select("id")
    .single()

  if (versionInsert.error) {
    throw new Error(versionInsert.error.message)
  }

  const createdVersionId = String(versionInsert.data.id)

  if (input.saveMode === "draft") {
    await archiveVersion(admin, "course_versions", stableRow.currentDraftVersionId, createdVersionId)
    const { error } = await admin
      .from("courses")
      .update({
        current_draft_version_id: createdVersionId,
        published: getDraftVisibility(existingCourse),
        updated_at: now
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    await archiveVersion(admin, "course_versions", stableRow.currentDraftVersionId, null)
    await archiveVersion(admin, "course_versions", stableRow.currentPublishedVersionId, createdVersionId)
    const { error } = await admin
      .from("courses")
      .update({
        ...buildCourseMirrorRow(input, true),
        current_published_version_id: createdVersionId,
        current_draft_version_id: null
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  }

  await recordContentEvent(admin, {
    contentType: "course",
    contentId: stableRow.id,
    eventType: input.saveMode === "publish" ? "publish" : "save_draft",
    changeSummary: input.saveMode === "publish" ? `Published course version ${nextVersionNumber}.` : `Saved course draft version ${nextVersionNumber}.`,
    actorId: actor.userId,
    actorEmail: actor.actorEmail,
    fromVersionId: sourceVersionId,
    toVersionId: createdVersionId,
    metadata: { title: input.title, slug: input.slug, versionNumber: nextVersionNumber }
  })

  return {
    stableRow: {
      ...stableRow,
      title: input.saveMode === "publish" || !existingCourse?.currentPublishedVersionId ? input.title : stableRow.title,
      summary: input.saveMode === "publish" || !existingCourse?.currentPublishedVersionId ? input.summary : stableRow.summary,
      difficulty: input.saveMode === "publish" || !existingCourse?.currentPublishedVersionId ? input.difficulty : stableRow.difficulty,
      accent: input.saveMode === "publish" || !existingCourse?.currentPublishedVersionId ? input.accent : stableRow.accent,
      published: input.saveMode === "publish" ? true : getDraftVisibility(existingCourse),
      currentPublishedVersionId: input.saveMode === "publish" ? createdVersionId : stableRow.currentPublishedVersionId,
      currentDraftVersionId: input.saveMode === "draft" ? createdVersionId : null
    },
    createdVersionId
  }
}

/**
 * Persists lesson content using append-only versions while preserving lesson
 * ordering and challenge attachment on the stable lesson row.
 */
export async function saveLessonVersion(
  admin: AdminClient,
  actor: Pick<AuthorizedCatalogContext, "userId" | "actorEmail">,
  input: LessonVersionInput
): Promise<SaveVersionResult<StableLessonRow>> {
  const versionProbe = await probeTable(admin, "lesson_versions")
  if (versionProbe.error && isMissingLessonVersionSchema(versionProbe.error)) {
    const legacyResult = await upsertLegacyLessonRecord(admin, input, input.saveMode === "publish")
    if (legacyResult.error) {
      throw new Error(legacyResult.error.message)
    }

    return {
      stableRow: {
        id: String(legacyResult.data.id),
        courseId: String(legacyResult.data.course_id),
        slug: String(legacyResult.data.slug),
        title: String(legacyResult.data.title),
        summary: String(legacyResult.data.summary ?? ""),
        estimatedMinutes: Number(legacyResult.data.estimated_minutes ?? 10),
        bodyMdx: String(legacyResult.data.body_mdx ?? ""),
        orderIndex: Number(legacyResult.data.order_index ?? 1),
        challengeSlug: legacyResult.data.challenge_slug ? String(legacyResult.data.challenge_slug) : null,
        published: Boolean(legacyResult.data.published ?? false),
        currentPublishedVersionId: null,
        currentDraftVersionId: null
      },
      createdVersionId: null
    }
  }

  if (versionProbe.error) {
    throw new Error(versionProbe.error.message)
  }

  const existingResult = await loadStableLessonRowBySlug(admin, input.courseId, input.slug)
  if (existingResult.error) {
    throw new Error(existingResult.error.message)
  }

  const existingLesson = existingResult.data
  const mirrorPublishedContent = input.saveMode === "publish" || !existingLesson?.currentPublishedVersionId
  const now = new Date().toISOString()
  const stableResult = await admin
    .from("lessons")
    .upsert(
      mirrorPublishedContent
        ? buildLessonMirrorRow(input, input.saveMode === "publish" ? true : Boolean(existingLesson?.currentPublishedVersionId))
        : {
            course_id: input.courseId,
            slug: input.slug,
            title: existingLesson?.title ?? input.title,
            summary: existingLesson?.summary ?? input.summary,
            estimated_minutes: existingLesson?.estimatedMinutes ?? input.estimatedMinutes,
            body_mdx: existingLesson?.bodyMdx ?? input.bodyMdx,
            challenge_slug: existingLesson?.challengeSlug ?? input.challengeSlug,
            order_index: existingLesson?.orderIndex ?? input.orderIndex,
            published: getDraftVisibility(existingLesson),
            updated_at: now
          },
      { onConflict: "course_id,slug" }
    )
    .select("id,course_id,slug,title,summary,estimated_minutes,body_mdx,order_index,challenge_slug,published,current_published_version_id,current_draft_version_id")
    .single()

  if (stableResult.error) {
    throw new Error(stableResult.error.message)
  }

  const stableRow: StableLessonRow = {
    id: String(stableResult.data.id),
    courseId: String(stableResult.data.course_id),
    slug: String(stableResult.data.slug),
    title: String(stableResult.data.title),
    summary: String(stableResult.data.summary ?? ""),
    estimatedMinutes: Number(stableResult.data.estimated_minutes ?? 10),
    bodyMdx: String(stableResult.data.body_mdx ?? ""),
    orderIndex: Number(stableResult.data.order_index ?? 1),
    challengeSlug: stableResult.data.challenge_slug ? String(stableResult.data.challenge_slug) : null,
    published: Boolean(stableResult.data.published ?? false),
    currentPublishedVersionId: stableResult.data.current_published_version_id ? String(stableResult.data.current_published_version_id) : null,
    currentDraftVersionId: stableResult.data.current_draft_version_id ? String(stableResult.data.current_draft_version_id) : null
  }

  const nextVersionNumber = await getNextVersionNumber(admin, "lesson_versions", "lesson_id", stableRow.id)
  const sourceVersionId = stableRow.currentDraftVersionId ?? stableRow.currentPublishedVersionId
  const versionInsert = await admin
    .from("lesson_versions")
    .insert({
      lesson_id: stableRow.id,
      version_number: nextVersionNumber,
      status: input.saveMode === "publish" ? "published" : "draft",
      source_version_id: sourceVersionId,
      title: input.title,
      summary: input.summary,
      estimated_minutes: input.estimatedMinutes,
      body_mdx: input.bodyMdx,
      created_by: actor.userId,
      published_by: input.saveMode === "publish" ? actor.userId : null,
      published_at: input.saveMode === "publish" ? now : null
    })
    .select("id")
    .single()

  if (versionInsert.error) {
    throw new Error(versionInsert.error.message)
  }

  const createdVersionId = String(versionInsert.data.id)

  if (input.saveMode === "draft") {
    await archiveVersion(admin, "lesson_versions", stableRow.currentDraftVersionId, createdVersionId)
    const { error } = await admin
      .from("lessons")
      .update({
        current_draft_version_id: createdVersionId,
        published: getDraftVisibility(existingLesson),
        updated_at: now
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    await archiveVersion(admin, "lesson_versions", stableRow.currentDraftVersionId, null)
    await archiveVersion(admin, "lesson_versions", stableRow.currentPublishedVersionId, createdVersionId)
    const { error } = await admin
      .from("lessons")
      .update({
        ...buildLessonMirrorRow(input, true),
        current_published_version_id: createdVersionId,
        current_draft_version_id: null
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  }

  await recordContentEvent(admin, {
    contentType: "lesson",
    contentId: stableRow.id,
    eventType: input.saveMode === "publish" ? "publish" : "save_draft",
    changeSummary: input.saveMode === "publish" ? `Published chapter version ${nextVersionNumber}.` : `Saved chapter draft version ${nextVersionNumber}.`,
    actorId: actor.userId,
    actorEmail: actor.actorEmail,
    fromVersionId: sourceVersionId,
    toVersionId: createdVersionId,
    metadata: { title: input.title, slug: input.slug, versionNumber: nextVersionNumber }
  })

  return {
    stableRow: {
      ...stableRow,
      title: input.saveMode === "publish" || !existingLesson?.currentPublishedVersionId ? input.title : stableRow.title,
      summary: input.saveMode === "publish" || !existingLesson?.currentPublishedVersionId ? input.summary : stableRow.summary,
      estimatedMinutes:
        input.saveMode === "publish" || !existingLesson?.currentPublishedVersionId ? input.estimatedMinutes : stableRow.estimatedMinutes,
      bodyMdx: input.saveMode === "publish" || !existingLesson?.currentPublishedVersionId ? input.bodyMdx : stableRow.bodyMdx,
      challengeSlug: input.challengeSlug ?? stableRow.challengeSlug,
      orderIndex: input.orderIndex,
      published: input.saveMode === "publish" ? true : getDraftVisibility(existingLesson),
      currentPublishedVersionId: input.saveMode === "publish" ? createdVersionId : stableRow.currentPublishedVersionId,
      currentDraftVersionId: input.saveMode === "draft" ? createdVersionId : null
    },
    createdVersionId
  }
}

/**
 * Persists assignment content with append-only versions so every authoring save
 * leaves a safe restore target instead of mutating history in place.
 */
export async function saveChallengeVersion(
  admin: AdminClient,
  actor: Pick<AuthorizedCatalogContext, "userId" | "actorEmail">,
  input: ChallengeVersionInput
): Promise<SaveVersionResult<StableChallengeRow>> {
  const versionProbe = await probeTable(admin, "challenge_versions")
  if (versionProbe.error && isMissingChallengeVersionSchema(versionProbe.error)) {
    const legacyResult = await upsertLegacyChallengeRecord(admin, input, input.saveMode === "publish")
    if (legacyResult.error) {
      throw new Error(legacyResult.error.message)
    }

    return {
      stableRow: mapLegacyChallengeRowToStableChallenge(legacyResult.data as Record<string, unknown>, input),
      createdVersionId: null
    }
  }

  if (versionProbe.error) {
    throw new Error(versionProbe.error.message)
  }

  const existingResult = await loadStableChallengeRowBySlug(admin, input.slug)
  if (existingResult.error) {
    throw new Error(existingResult.error.message)
  }

  const existingChallenge = existingResult.data
  const mirrorPublishedContent = input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId
  const now = new Date().toISOString()
  const stableResult = await admin
    .from("challenges")
    .upsert(
      mirrorPublishedContent
        ? buildChallengeMirrorRow(input, input.saveMode === "publish" ? true : Boolean(existingChallenge?.currentPublishedVersionId))
        : {
            slug: input.slug,
            title: existingChallenge?.title ?? input.title,
            published: getDraftVisibility(existingChallenge),
            updated_at: now
          },
      { onConflict: "slug" }
    )
    .select("id,slug,title,kind,language,judge0_language_id,reading_mdx,prompt_mdx,starter_code,solution_code,hidden_test_code,choice_options,choice_correct_key,choice_explanation_mdx,published,current_published_version_id,current_draft_version_id")
    .single()

  if (stableResult.error) {
    if (isMissingChallengeVersionSchema(stableResult.error)) {
      const legacyResult = await upsertLegacyChallengeRecord(admin, input, input.saveMode === "publish")
      if (legacyResult.error) {
        throw new Error(legacyResult.error.message)
      }

      return {
        stableRow: mapLegacyChallengeRowToStableChallenge(legacyResult.data as Record<string, unknown>, input),
        createdVersionId: null
      }
    }

    throw new Error(stableResult.error.message)
  }

  const stableRow: StableChallengeRow = {
    id: String(stableResult.data.id),
    slug: String(stableResult.data.slug),
    title: String(stableResult.data.title),
    kind: String(stableResult.data.kind ?? input.kind) as ChallengeKind,
    language: stableResult.data.language ? (String(stableResult.data.language) as CodeChallengeLanguage) : null,
    judge0LanguageId: typeof stableResult.data.judge0_language_id === "number" ? stableResult.data.judge0_language_id : null,
    readingMdx: stableResult.data.reading_mdx ? String(stableResult.data.reading_mdx) : null,
    promptMdx: String(stableResult.data.prompt_mdx ?? ""),
    starterCode: String(stableResult.data.starter_code ?? ""),
    solutionCode: String(stableResult.data.solution_code ?? ""),
    hiddenTestCode: String(stableResult.data.hidden_test_code ?? ""),
    choiceOptions: Array.isArray(stableResult.data.choice_options)
      ? (stableResult.data.choice_options as MultipleChoiceOption[])
      : [],
    correctChoiceKey: stableResult.data.choice_correct_key ? String(stableResult.data.choice_correct_key) : null,
    choiceExplanationMdx: String(stableResult.data.choice_explanation_mdx ?? ""),
    published: Boolean(stableResult.data.published ?? false),
    currentPublishedVersionId: stableResult.data.current_published_version_id ? String(stableResult.data.current_published_version_id) : null,
    currentDraftVersionId: stableResult.data.current_draft_version_id ? String(stableResult.data.current_draft_version_id) : null
  }

  const nextVersionNumber = await getNextVersionNumber(admin, "challenge_versions", "challenge_id", stableRow.id)
  const sourceVersionId = stableRow.currentDraftVersionId ?? stableRow.currentPublishedVersionId
  const versionInsert = await admin
    .from("challenge_versions")
    .insert({
      challenge_id: stableRow.id,
      version_number: nextVersionNumber,
      status: input.saveMode === "publish" ? "published" : "draft",
      source_version_id: sourceVersionId,
      title: input.title,
      kind: input.kind,
      language: input.language,
      judge0_language_id: input.judge0LanguageId,
      reading_mdx: input.readingMdx,
      prompt_mdx: input.promptMdx,
      starter_code: input.storageFields.starterCode,
      solution_code: input.storageFields.solutionCode,
      hidden_test_code: input.storageFields.hiddenTestCode,
      choice_options: input.kind === "multiple_choice" ? input.choiceOptions : [],
      choice_correct_key: input.kind === "multiple_choice" ? input.correctChoiceKey : null,
      choice_explanation_mdx: input.kind === "multiple_choice" ? input.choiceExplanationMdx : "",
      created_by: actor.userId,
      published_by: input.saveMode === "publish" ? actor.userId : null,
      published_at: input.saveMode === "publish" ? now : null
    })
    .select("id")
    .single()

  if (versionInsert.error) {
    throw new Error(versionInsert.error.message)
  }

  const createdVersionId = String(versionInsert.data.id)

  if (input.saveMode === "draft") {
    await archiveVersion(admin, "challenge_versions", stableRow.currentDraftVersionId, createdVersionId)
    const { error } = await admin
      .from("challenges")
      .update({
        current_draft_version_id: createdVersionId,
        published: getDraftVisibility(existingChallenge),
        updated_at: now
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    await archiveVersion(admin, "challenge_versions", stableRow.currentDraftVersionId, null)
    await archiveVersion(admin, "challenge_versions", stableRow.currentPublishedVersionId, createdVersionId)
    const { error } = await admin
      .from("challenges")
      .update({
        ...buildChallengeMirrorRow(input, true),
        current_published_version_id: createdVersionId,
        current_draft_version_id: null
      })
      .eq("id", stableRow.id)

    if (error) {
      throw new Error(error.message)
    }
  }

  await recordContentEvent(admin, {
    contentType: "challenge",
    contentId: stableRow.id,
    eventType: input.saveMode === "publish" ? "publish" : "save_draft",
    changeSummary:
      input.saveMode === "publish"
        ? `Published assignment version ${nextVersionNumber}.`
        : `Saved assignment draft version ${nextVersionNumber}.`,
    actorId: actor.userId,
    actorEmail: actor.actorEmail,
    fromVersionId: sourceVersionId,
    toVersionId: createdVersionId,
    metadata: { title: input.title, slug: input.slug, kind: input.kind, versionNumber: nextVersionNumber }
  })

  return {
    stableRow: {
      ...stableRow,
      title: input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId ? input.title : stableRow.title,
      kind: input.kind,
      language: input.language,
      judge0LanguageId: input.judge0LanguageId,
      readingMdx:
        input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId ? input.readingMdx : stableRow.readingMdx,
      promptMdx:
        input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId ? input.promptMdx : stableRow.promptMdx,
      starterCode:
        input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId
          ? input.storageFields.starterCode
          : stableRow.starterCode,
      solutionCode:
        input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId
          ? input.storageFields.solutionCode
          : stableRow.solutionCode,
      hiddenTestCode:
        input.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId
          ? input.storageFields.hiddenTestCode
          : stableRow.hiddenTestCode,
      choiceOptions: input.kind === "multiple_choice" ? input.choiceOptions : [],
      correctChoiceKey: input.kind === "multiple_choice" ? input.correctChoiceKey : null,
      choiceExplanationMdx: input.kind === "multiple_choice" ? input.choiceExplanationMdx : "",
      published: input.saveMode === "publish" ? true : getDraftVisibility(existingChallenge),
      currentPublishedVersionId: input.saveMode === "publish" ? createdVersionId : stableRow.currentPublishedVersionId,
      currentDraftVersionId: input.saveMode === "draft" ? createdVersionId : null
    },
    createdVersionId
  }
}

/**
 * Converts explicit local-lab fields into the current stable challenge storage
 * shape so import and duplication flows can stay challenge-kind agnostic.
 */
export function buildLocalLabStorageFields(fields: {
  submitCommandTemplate: string
  solutionNotes: string
  manifestSource: string
}) {
  return getLocalLabChallengeStorageFields(fields)
}
