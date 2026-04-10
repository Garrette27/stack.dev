import "server-only"

import { z } from "zod"

import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { isSupportedChallengeLanguage } from "@/lib/judge0/languages"
import {
  buildDefaultLocalLabCommandTemplate,
  buildDefaultLocalLabManifestSource,
  getLocalLabChallengeStorageFields,
  parseLocalLabManifestSource
} from "@/lib/local-labs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { CodeChallengeLanguage, MultipleChoiceOption } from "@/lib/types"
import { slugify } from "@/lib/utils"

export type AuthoringSaveResult = {
  success: boolean
  message: string
  savedCourseSlug?: string
  savedLessonSlug?: string
  savedChallengeSlug?: string
}

export type AuthoringSaveMode = "draft" | "publish"

const authoringBaseSchema = z.object({
  courseTitle: z.string().min(3),
  courseSlug: z.string().min(3),
  lessonTitle: z.string().min(3),
  lessonSlug: z.string().min(3),
  bodyMdx: z.string(),
  challengeSlug: z.string().optional(),
  saveMode: z.enum(["draft", "publish"]),
  kind: z.enum(["code", "multiple_choice", "local_lab"]),
  language: z.string().optional(),
  judge0LanguageId: z.string().optional(),
  readingMdx: z.string().optional(),
  promptMdx: z.string().min(10),
  starterCode: z.string().optional(),
  solutionCode: z.string().optional(),
  hiddenTestCode: z.string().optional(),
  choiceOptionsJson: z.string().optional(),
  choiceCorrectKey: z.string().optional(),
  choiceExplanationMdx: z.string().optional()
})

type CodeAuthoringBundleInput = {
  courseTitle: string
  courseSlug: string
  lessonTitle: string
  lessonSlug: string
  bodyMdx: string
  challengeSlug?: string
  saveMode: AuthoringSaveMode
  kind: "code"
  language: CodeChallengeLanguage
  judge0LanguageId: number
  readingMdx?: string
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
}

type MultipleChoiceAuthoringBundleInput = {
  courseTitle: string
  courseSlug: string
  lessonTitle: string
  lessonSlug: string
  bodyMdx: string
  challengeSlug?: string
  saveMode: AuthoringSaveMode
  kind: "multiple_choice"
  language: null
  judge0LanguageId: null
  readingMdx?: string
  promptMdx: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  choiceOptions: MultipleChoiceOption[]
  correctChoiceKey: string
  choiceExplanationMdx: string
}

type LocalLabAuthoringBundleInput = {
  courseTitle: string
  courseSlug: string
  lessonTitle: string
  lessonSlug: string
  bodyMdx: string
  challengeSlug?: string
  saveMode: AuthoringSaveMode
  kind: "local_lab"
  language: null
  judge0LanguageId: null
  readingMdx?: string
  promptMdx: string
  submitCommandTemplate: string
  solutionNotes: string
  manifestSource: string
}

type AuthoringBundleInput = CodeAuthoringBundleInput | MultipleChoiceAuthoringBundleInput | LocalLabAuthoringBundleInput

type ParsedAuthoringBundle =
  | {
      success: true
      data: AuthoringBundleInput
    }
  | {
      success: false
      message: string
    }

type RelationInsertResult = {
  tableAvailable: boolean
}

function isMissingReadingColumn(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return error.code === "42703" || error.code === "PGRST204" || error.message?.includes("reading_mdx") === true
}

function isMissingMultipleChoiceColumn(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("kind") === true ||
    error.message?.includes("choice_options") === true ||
    error.message?.includes("choice_correct_key") === true ||
    error.message?.includes("choice_explanation_mdx") === true
  )
}

function isMissingChallengeKindColumn(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("kind") === true
  )
}

function getChallengeStorageFields(payload: AuthoringBundleInput) {
  if (payload.kind === "local_lab") {
    return getLocalLabChallengeStorageFields({
      submitCommandTemplate: payload.submitCommandTemplate,
      solutionNotes: payload.solutionNotes,
      manifestSource: payload.manifestSource
    })
  }

  return {
    starterCode: payload.starterCode,
    solutionCode: payload.solutionCode,
    hiddenTestCode: payload.hiddenTestCode
  }
}

/**
 * Normalizes browser FormData values into plain strings so optional authoring
 * fields can be omitted without leaking `null` into the parser.
 */
function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

/**
 * Parses and normalizes the authoring form into a single bundle payload.
 */
export function parseAuthoringBundleFormData(formData: FormData): ParsedAuthoringBundle {
  const parsed = authoringBaseSchema.safeParse({
    courseTitle: readFormString(formData, "courseTitle"),
    courseSlug: slugify(readFormString(formData, "courseSlug")),
    lessonTitle: readFormString(formData, "lessonTitle"),
    lessonSlug: slugify(readFormString(formData, "lessonSlug")),
    bodyMdx: readFormString(formData, "bodyMdx"),
    challengeSlug: slugify(readFormString(formData, "challengeSlug")),
    saveMode: readFormString(formData, "saveMode") || "publish",
    kind: readFormString(formData, "kind"),
    language: readFormString(formData, "language"),
    judge0LanguageId: readFormString(formData, "judge0LanguageId"),
    readingMdx: readFormString(formData, "readingMdx"),
    promptMdx: readFormString(formData, "promptMdx"),
    starterCode: readFormString(formData, "starterCode"),
    solutionCode: readFormString(formData, "solutionCode"),
    hiddenTestCode: readFormString(formData, "hiddenTestCode"),
    choiceOptionsJson: readFormString(formData, "choiceOptionsJson"),
    choiceCorrectKey: readFormString(formData, "choiceCorrectKey"),
    choiceExplanationMdx: readFormString(formData, "choiceExplanationMdx")
  })

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid form payload."
    }
  }

  if (parsed.data.kind === "code") {
    const language = parsed.data.language?.trim() ?? ""
    if (!isSupportedChallengeLanguage(language)) {
      return {
        success: false,
        message: "Choose a supported code language."
      }
    }

    const judge0LanguageId = Number(parsed.data.judge0LanguageId)
    if (!Number.isInteger(judge0LanguageId) || judge0LanguageId < 1) {
      return {
        success: false,
        message: "Checker language id must be a positive number."
      }
    }

    const starterCode = parsed.data.starterCode?.trim() ?? ""
    const solutionCode = parsed.data.solutionCode?.trim() ?? ""
    const hiddenTestCode = parsed.data.hiddenTestCode?.trim() ?? ""

    if (starterCode.length < 5 || solutionCode.length < 5 || hiddenTestCode.length < 5) {
      return {
        success: false,
        message: "Code assignments need starter code, a reference solution, and hidden tests."
      }
    }

    return {
      success: true,
      data: {
        courseTitle: parsed.data.courseTitle,
        courseSlug: parsed.data.courseSlug,
        lessonTitle: parsed.data.lessonTitle,
        lessonSlug: parsed.data.lessonSlug,
        bodyMdx: parsed.data.bodyMdx,
        challengeSlug: parsed.data.challengeSlug,
        saveMode: parsed.data.saveMode,
        kind: "code",
        language,
        judge0LanguageId,
        readingMdx: parsed.data.readingMdx,
        promptMdx: parsed.data.promptMdx,
        starterCode,
        solutionCode,
        hiddenTestCode
      }
    }
  }

  if (parsed.data.kind === "local_lab") {
    const submitCommandTemplate = parsed.data.starterCode?.trim() || buildDefaultLocalLabCommandTemplate()
    const solutionNotes = parsed.data.solutionCode?.trim() ?? ""
    const manifestSource = parsed.data.hiddenTestCode?.trim() || buildDefaultLocalLabManifestSource()
    const manifestResult = parseLocalLabManifestSource(manifestSource)

    if (submitCommandTemplate.length < 3) {
      return {
        success: false,
        message: "Local labs need a CLI submit command template."
      }
    }

    if (!manifestResult.success) {
      return {
        success: false,
        message: manifestResult.message
      }
    }

    return {
      success: true,
      data: {
        courseTitle: parsed.data.courseTitle,
        courseSlug: parsed.data.courseSlug,
        lessonTitle: parsed.data.lessonTitle,
        lessonSlug: parsed.data.lessonSlug,
        bodyMdx: parsed.data.bodyMdx,
        challengeSlug: parsed.data.challengeSlug,
        saveMode: parsed.data.saveMode,
        kind: "local_lab",
        language: null,
        judge0LanguageId: null,
        readingMdx: parsed.data.readingMdx,
        promptMdx: parsed.data.promptMdx,
        submitCommandTemplate,
        solutionNotes,
        manifestSource
      }
    }
  }

  let rawChoiceOptions: unknown = []
  try {
    rawChoiceOptions = JSON.parse(parsed.data.choiceOptionsJson || "[]")
  } catch {
    return {
      success: false,
      message: "Multiple-choice options could not be parsed."
    }
  }

  const choiceOptions = normalizeMultipleChoiceOptions(rawChoiceOptions)
    .map((option) => ({
      ...option,
      label: option.label.trim()
    }))
    .filter((option) => option.label.length > 0)

  if (choiceOptions.length < 2) {
    return {
      success: false,
      message: "Add at least two answer choices."
    }
  }

  const correctChoiceKey = parsed.data.choiceCorrectKey ?? ""

  if (!choiceOptions.some((option) => option.key === correctChoiceKey)) {
    return {
      success: false,
      message: "Choose which answer is correct."
    }
  }

  return {
    success: true,
    data: {
      courseTitle: parsed.data.courseTitle,
      courseSlug: parsed.data.courseSlug,
      lessonTitle: parsed.data.lessonTitle,
      lessonSlug: parsed.data.lessonSlug,
        bodyMdx: parsed.data.bodyMdx,
        challengeSlug: parsed.data.challengeSlug,
        saveMode: parsed.data.saveMode,
        kind: "multiple_choice",
      language: null,
      judge0LanguageId: null,
      readingMdx: parsed.data.readingMdx,
      promptMdx: parsed.data.promptMdx,
      starterCode: "",
      solutionCode: "",
      hiddenTestCode: "",
      choiceOptions,
      correctChoiceKey,
      choiceExplanationMdx: parsed.data.choiceExplanationMdx ?? ""
    }
  }
}

/**
 * Attaches a challenge to a lesson when the multi-question relation table is available.
 * Older databases without the table keep using the legacy single challenge field.
 */
async function attachChallengeToLesson(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  lessonId: string,
  challengeId: string
): Promise<RelationInsertResult> {
  const { data: relationRows, error: relationError } = await admin
    .from("lesson_challenges")
    .select("challenge_id, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index")

  if (relationError?.code === "42P01" || relationError?.code === "PGRST205") {
    return { tableAvailable: false }
  }

  if (relationError) {
    throw new Error(relationError.message)
  }

  const existingRelation = (relationRows ?? []).find((row) => String(row.challenge_id) === challengeId)

  if (!existingRelation) {
    const nextOrderIndex = (relationRows?.length ?? 0) + 1
    const { error: insertError } = await admin.from("lesson_challenges").insert({
      lesson_id: lessonId,
      challenge_id: challengeId,
      order_index: nextOrderIndex
    })

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  return { tableAvailable: true }
}

/**
 * Derives a compact internal challenge title from the public assignment prompt.
 * This keeps the authoring form focused on chapter and assignment content.
 */
function deriveChallengeTitle(promptMdx: string) {
  const firstMeaningfulLine = promptMdx
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find(Boolean)

  if (!firstMeaningfulLine) {
    return "Assignment"
  }

  return firstMeaningfulLine.length > 96
    ? `${firstMeaningfulLine.slice(0, 93).trimEnd()}...`
    : firstMeaningfulLine
}

/**
 * Derives a compact chapter summary from the optional guide text when present.
 * Blank chapter guides fall back to the lesson title so authors can leave the
 * guide empty without degrading the lesson card copy.
 */
function deriveLessonSummary(bodyMdx: string, lessonTitle: string) {
  const firstMeaningfulLine = bodyMdx
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find(Boolean)

  if (!firstMeaningfulLine) {
    return `${lessonTitle} practice and assignments.`
  }

  return firstMeaningfulLine.length > 120
    ? `${firstMeaningfulLine.slice(0, 117).trimEnd()}...`
    : firstMeaningfulLine
}

/**
 * Allocates a stable internal slug for a new assignment inside the lesson.
 * Existing assignments keep their slug so edits remain idempotent.
 */
async function resolveChallengeSlug(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  lessonSlug: string,
  providedChallengeSlug?: string
) {
  if (providedChallengeSlug) {
    return providedChallengeSlug
  }

  const baseSlug = slugify(`${lessonSlug}-assignment`) || "assignment"
  const { data: existingRows, error } = await admin
    .from("challenges")
    .select("slug")
    .like("slug", `${baseSlug}%`)

  if (error) {
    throw new Error(error.message)
  }

  const existingSlugs = new Set((existingRows ?? []).map((row) => String(row.slug)))
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

/**
 * Treats missing versioning tables as a legacy schema so authoring can keep
 * saving direct challenge rows until the migration is applied.
 */
function isMissingChallengeVersionSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("challenge_versions") === true ||
    error.message?.includes("current_published_version_id") === true ||
    error.message?.includes("current_draft_version_id") === true
  )
}

type StableChallengeRow = {
  id: string
  published: boolean
  currentPublishedVersionId: string | null
  currentDraftVersionId: string | null
}

function buildChallengeMirrorRow(
  challengeSlug: string,
  challengeTitle: string,
  payload: AuthoringBundleInput,
  readingMdx: string | null,
  published: boolean
) {
  const storageFields = getChallengeStorageFields(payload)

  return {
    slug: challengeSlug,
    title: challengeTitle,
    kind: payload.kind,
    language: payload.language,
    judge0_language_id: payload.judge0LanguageId,
    reading_mdx: readingMdx,
    prompt_mdx: payload.promptMdx,
    starter_code: storageFields.starterCode,
    solution_code: storageFields.solutionCode,
    hidden_test_code: storageFields.hiddenTestCode,
    choice_options: payload.kind === "multiple_choice" ? payload.choiceOptions : [],
    choice_correct_key: payload.kind === "multiple_choice" ? payload.correctChoiceKey : null,
    choice_explanation_mdx: payload.kind === "multiple_choice" ? payload.choiceExplanationMdx : "",
    published,
    updated_at: new Date().toISOString()
  }
}

async function loadStableChallengeRow(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  challengeSlug: string
) {
  const result = await admin
    .from("challenges")
    .select("id,published,current_published_version_id,current_draft_version_id")
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
      published: Boolean(result.data.published ?? true),
      currentPublishedVersionId: result.data.current_published_version_id
        ? String(result.data.current_published_version_id)
        : null,
      currentDraftVersionId: result.data.current_draft_version_id
        ? String(result.data.current_draft_version_id)
        : null
    } satisfies StableChallengeRow,
    error: null
  }
}

/**
 * Draft saves should preserve an assignment's existing learner visibility
 * instead of silently republishing previously hidden content.
 */
function getDraftChallengeVisibility(challengeRow: StableChallengeRow) {
  return challengeRow.published && Boolean(challengeRow.currentPublishedVersionId)
}

async function upsertLegacyChallengeRecord(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  payload: AuthoringBundleInput,
  challengeSlug: string,
  challengeTitle: string,
  readingMdx: string | null,
  published: boolean
) {
  const storageFields = getChallengeStorageFields(payload)
  const fullResult = await admin
    .from("challenges")
    .upsert(
      buildChallengeMirrorRow(challengeSlug, challengeTitle, payload, readingMdx, published),
      {
        onConflict: "slug"
      }
    )
    .select("id")
    .single()

  if (!fullResult.error) {
    return fullResult
  }

  if (payload.kind === "multiple_choice" && isMissingMultipleChoiceColumn(fullResult.error)) {
    return {
      data: null,
      error: {
        ...fullResult.error,
        message: "Apply the multiple-choice challenge migration before saving quiz assignments."
      }
    }
  }

  if (payload.kind === "local_lab" && isMissingChallengeKindColumn(fullResult.error)) {
    return {
      data: null,
      error: {
        ...fullResult.error,
        message: "Apply the local-lab challenge migration before saving local lab assignments."
      }
    }
  }

  if (!isMissingReadingColumn(fullResult.error) && !isMissingMultipleChoiceColumn(fullResult.error) && !isMissingChallengeKindColumn(fullResult.error)) {
    return fullResult
  }

  return admin
    .from("challenges")
    .upsert(
      {
        slug: challengeSlug,
        title: challengeTitle,
        language: payload.kind === "code" ? payload.language : null,
        judge0_language_id: payload.kind === "code" ? payload.judge0LanguageId : null,
        prompt_mdx: payload.promptMdx,
        starter_code: storageFields.starterCode,
        solution_code: storageFields.solutionCode,
        hidden_test_code: storageFields.hiddenTestCode,
        published
      },
      {
        onConflict: "slug"
      }
    )
    .select("id")
    .single()
}

async function getNextChallengeVersionNumber(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  challengeId: string
) {
  const { data, error } = await admin
    .from("challenge_versions")
    .select("version_number")
    .eq("challenge_id", challengeId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return Number(data?.version_number ?? 0) + 1
}

async function archivePublishedChallengeVersion(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  versionId: string | null,
  exceptVersionId: string | null
) {
  if (!versionId || versionId === exceptVersionId) {
    return
  }

  const { error } = await admin
    .from("challenge_versions")
    .update({
      status: "archived",
      updated_at: new Date().toISOString()
    })
    .eq("id", versionId)

  if (error) {
    throw new Error(error.message)
  }
}

async function upsertVersionedChallengeRecord(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  payload: AuthoringBundleInput,
  challengeSlug: string,
  challengeTitle: string,
  readingMdx: string | null
) {
  const existingChallengeResult = await loadStableChallengeRow(admin, challengeSlug)
  if (existingChallengeResult.error) {
    if (isMissingChallengeVersionSchema(existingChallengeResult.error)) {
      return upsertLegacyChallengeRecord(
        admin,
        payload,
        challengeSlug,
        challengeTitle,
        readingMdx,
        payload.saveMode === "publish"
      )
    }

    return {
      data: null,
      error: existingChallengeResult.error
    }
  }

  const existingChallenge = existingChallengeResult.data
  const mirrorPublishedContent = payload.saveMode === "publish" || !existingChallenge?.currentPublishedVersionId
  const mirroredChallengeRow = buildChallengeMirrorRow(
    challengeSlug,
    challengeTitle,
    payload,
    readingMdx,
    payload.saveMode === "publish" ? true : Boolean(existingChallenge?.currentPublishedVersionId)
  )

  const stableChallengeResult = await admin
    .from("challenges")
    .upsert(
      mirrorPublishedContent
        ? mirroredChallengeRow
        : {
            slug: challengeSlug,
            title: existingChallenge ? challengeTitle : mirroredChallengeRow.title,
            published: existingChallenge?.published ?? false,
            updated_at: new Date().toISOString()
          },
      {
        onConflict: "slug"
      }
    )
    .select("id,published,current_published_version_id,current_draft_version_id")
    .single()

  if (stableChallengeResult.error) {
    if (isMissingChallengeVersionSchema(stableChallengeResult.error)) {
      return upsertLegacyChallengeRecord(
        admin,
        payload,
        challengeSlug,
        challengeTitle,
        readingMdx,
        payload.saveMode === "publish"
      )
    }

    return {
      data: null,
      error: stableChallengeResult.error
    }
  }

  const challengeRow = {
    id: String(stableChallengeResult.data.id),
    published: Boolean(stableChallengeResult.data.published ?? false),
    currentPublishedVersionId: stableChallengeResult.data.current_published_version_id
      ? String(stableChallengeResult.data.current_published_version_id)
      : null,
    currentDraftVersionId: stableChallengeResult.data.current_draft_version_id
      ? String(stableChallengeResult.data.current_draft_version_id)
      : null
  } satisfies StableChallengeRow

  const now = new Date().toISOString()
  const storageFields = getChallengeStorageFields(payload)
  const versionPayload = {
    challenge_id: challengeRow.id,
    title: challengeTitle,
    kind: payload.kind,
    language: payload.language,
    judge0_language_id: payload.judge0LanguageId,
    reading_mdx: readingMdx,
    prompt_mdx: payload.promptMdx,
    starter_code: storageFields.starterCode,
    solution_code: storageFields.solutionCode,
    hidden_test_code: storageFields.hiddenTestCode,
    choice_options: payload.kind === "multiple_choice" ? payload.choiceOptions : [],
    choice_correct_key: payload.kind === "multiple_choice" ? payload.correctChoiceKey : null,
    choice_explanation_mdx: payload.kind === "multiple_choice" ? payload.choiceExplanationMdx : "",
    updated_at: now
  }

  if (payload.saveMode === "draft") {
    let draftVersionId = challengeRow.currentDraftVersionId

    if (draftVersionId) {
      const { error: draftUpdateError } = await admin
        .from("challenge_versions")
        .update({
          ...versionPayload,
          status: "draft"
        })
        .eq("id", draftVersionId)

      if (draftUpdateError) {
        return { data: null, error: draftUpdateError }
      }
    } else {
      const nextVersionNumber = await getNextChallengeVersionNumber(admin, challengeRow.id)
      const { data: draftRow, error: draftInsertError } = await admin
        .from("challenge_versions")
        .insert({
          ...versionPayload,
          version_number: nextVersionNumber,
          status: "draft",
          source_version_id: challengeRow.currentPublishedVersionId,
          created_by: userId
        })
        .select("id")
        .single()

      if (draftInsertError) {
        return { data: null, error: draftInsertError }
      }

      draftVersionId = String(draftRow.id)
    }

    const { data: updatedChallenge, error: challengeUpdateError } = await admin
      .from("challenges")
      .update({
        current_draft_version_id: draftVersionId,
        published: getDraftChallengeVisibility(challengeRow),
        updated_at: now
      })
      .eq("id", challengeRow.id)
      .select("id")
      .single()

    if (challengeUpdateError) {
      return { data: null, error: challengeUpdateError }
    }

    return {
      data: updatedChallenge,
      error: null
    }
  }

  let publishedVersionId = challengeRow.currentDraftVersionId

  if (publishedVersionId) {
    const { error: publishDraftError } = await admin
      .from("challenge_versions")
      .update({
        ...versionPayload,
        status: "published",
        published_at: now,
        published_by: userId
      })
      .eq("id", publishedVersionId)

    if (publishDraftError) {
      return { data: null, error: publishDraftError }
    }
  } else {
    const nextVersionNumber = await getNextChallengeVersionNumber(admin, challengeRow.id)
    const { data: publishedRow, error: publishInsertError } = await admin
      .from("challenge_versions")
      .insert({
        ...versionPayload,
        version_number: nextVersionNumber,
        status: "published",
        source_version_id: challengeRow.currentPublishedVersionId,
        created_by: userId,
        published_by: userId,
        published_at: now
      })
      .select("id")
      .single()

    if (publishInsertError) {
      return { data: null, error: publishInsertError }
    }

    publishedVersionId = String(publishedRow.id)
  }

  await archivePublishedChallengeVersion(admin, challengeRow.currentPublishedVersionId, publishedVersionId)

  const { data: updatedChallenge, error: publishedChallengeError } = await admin
    .from("challenges")
    .update({
      ...mirroredChallengeRow,
      current_published_version_id: publishedVersionId,
      current_draft_version_id: null
    })
    .eq("id", challengeRow.id)
    .select("id")
    .single()

  if (publishedChallengeError) {
    return { data: null, error: publishedChallengeError }
  }

  return {
    data: updatedChallenge,
    error: null
  }
}

/**
 * Persists assignment content while tolerating older databases that have not
 * added challenge-versioning tables yet.
 */
async function upsertChallengeRecord(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  payload: AuthoringBundleInput,
  challengeSlug: string,
  challengeTitle: string,
  readingMdx: string | null
) {
  const versionProbe = await admin.from("challenge_versions").select("id").limit(1)

  if (versionProbe.error && isMissingChallengeVersionSchema(versionProbe.error)) {
    return upsertLegacyChallengeRecord(
      admin,
      payload,
      challengeSlug,
      challengeTitle,
      readingMdx,
      payload.saveMode === "publish"
    )
  }

  if (versionProbe.error) {
    return {
      data: null,
      error: versionProbe.error
    }
  }

  return upsertVersionedChallengeRecord(admin, userId, payload, challengeSlug, challengeTitle, readingMdx)
}

/**
 * Persists a full lesson-and-challenge bundle for the current admin user.
 */
export async function saveAuthoringBundleForCurrentUser(payload: AuthoringBundleInput): Promise<AuthoringSaveResult> {
  const user = await getCurrentUser()
  const isAdmin = user ? await isCurrentUserAdmin() : false

  if (!user) {
    return {
      success: false,
      message: "Sign in first."
    }
  }

  if (!isAdmin) {
    return {
      success: false,
      message: "This account does not have authoring access."
    }
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      message: "Saving is unavailable until admin access is configured for this project."
    }
  }

  const admin = createAdminClient()
  const challengeTitle = deriveChallengeTitle(payload.promptMdx)
  const lessonSummary = deriveLessonSummary(payload.bodyMdx, payload.lessonTitle)
  // Only persist a challenge-level reading override when the author explicitly
  // adds one. Blank input means the assignment should fall back to its own
  // prompt, with the chapter guide remaining optional.
  const normalizedReadingMdx = payload.readingMdx?.trim() ? payload.readingMdx.trim() : null
  const { data: existingCourse, error: existingCourseError } = await admin!
    .from("courses")
    .select("id,published")
    .eq("slug", payload.courseSlug)
    .maybeSingle()

  if (existingCourseError) {
    return {
      success: false,
      message: existingCourseError.message
    }
  }

  const shouldPublishCourse = payload.saveMode === "publish" ? true : Boolean(existingCourse?.published ?? false)
  const { data: courseRow, error: courseError } = await admin!
    .from("courses")
    .upsert(
      {
        slug: payload.courseSlug,
        title: payload.courseTitle,
        summary: `A practical path into software with ${payload.courseTitle.toLowerCase()}.`,
        difficulty: "Beginner",
        accent: "#c96f36",
        published: shouldPublishCourse
      },
      {
        onConflict: "slug"
      }
    )
    .select("id")
    .single()

  if (courseError) {
    return {
      success: false,
      message: courseError.message
    }
  }

  const challengeSlug = await resolveChallengeSlug(admin!, payload.lessonSlug, payload.challengeSlug)
  const { data: challengeRow, error: challengeError } = await upsertChallengeRecord(
    admin!,
    user.id,
    payload,
    challengeSlug,
    challengeTitle,
    normalizedReadingMdx
  )

  if (challengeError) {
    return {
      success: false,
      message: challengeError.message
    }
  }

  const [{ data: existingLesson }, { count: lessonCount }] = await Promise.all([
    admin!
      .from("lessons")
      .select("id, order_index, challenge_slug, estimated_minutes, published")
      .eq("course_id", courseRow.id)
      .eq("slug", payload.lessonSlug)
      .maybeSingle(),
    admin!.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseRow.id)
  ])

  const shouldPublishLesson = payload.saveMode === "publish" ? true : Boolean(existingLesson?.published ?? false)

  const { data: lessonRow, error: lessonError } = await admin!.from("lessons").upsert(
    {
      course_id: courseRow.id,
      slug: payload.lessonSlug,
      title: payload.lessonTitle,
      summary: lessonSummary,
      estimated_minutes: existingLesson?.estimated_minutes ?? 10,
      body_mdx: payload.bodyMdx,
      challenge_slug: existingLesson?.challenge_slug ?? challengeSlug,
      order_index: existingLesson?.order_index ?? (lessonCount ?? 0) + 1,
      published: shouldPublishLesson
    },
    {
      onConflict: "course_id,slug"
    }
  ).select("id")
   .single()

  if (lessonError) {
    return {
      success: false,
      message: lessonError.message
    }
  }

  try {
    const relationResult = await attachChallengeToLesson(admin!, lessonRow.id, challengeRow.id)

    if (!relationResult.tableAvailable && existingLesson?.challenge_slug && existingLesson.challenge_slug !== challengeSlug) {
      return {
        success: false,
        message: "This database still supports one question per lesson. Apply the lesson_challenges migration first."
      }
    }

    if (!relationResult.tableAvailable && !existingLesson?.challenge_slug) {
      const { error: legacyLessonError } = await admin!
        .from("lessons")
        .update({ challenge_slug: challengeSlug })
        .eq("id", lessonRow.id)

      if (legacyLessonError) {
        return {
          success: false,
          message: legacyLessonError.message
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to attach the question to the lesson."
    }
  }

  return {
    success: true,
    message: payload.saveMode === "draft" ? "Draft saved." : "Chapter and assignment published.",
    savedCourseSlug: payload.courseSlug,
    savedLessonSlug: payload.lessonSlug,
    savedChallengeSlug: challengeSlug
  }
}
