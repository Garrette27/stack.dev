import "server-only"

import { z } from "zod"

import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import {
  saveChallengeVersion,
  saveCourseVersion,
  saveLessonVersion
} from "@/lib/admin/catalog-versioning"
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
  let courseId = ""
  try {
    const courseResult = await saveCourseVersion(admin!, {
      userId: user.id,
      actorEmail: user.email ?? null
    }, {
      slug: payload.courseSlug,
      title: payload.courseTitle,
      summary: `A practical path into software with ${payload.courseTitle.toLowerCase()}.`,
      difficulty: "Beginner",
      accent: "#c96f36",
      saveMode: payload.saveMode
    })

    courseId = courseResult.stableRow.id
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save the course."
    }
  }

  const challengeSlug = await resolveChallengeSlug(admin!, payload.lessonSlug, payload.challengeSlug)
  let challengeId = ""
  try {
    const challengeResult = await saveChallengeVersion(admin!, {
      userId: user.id,
      actorEmail: user.email ?? null
    }, {
      slug: challengeSlug,
      title: challengeTitle,
      kind: payload.kind,
      language: payload.language,
      judge0LanguageId: payload.judge0LanguageId,
      readingMdx: normalizedReadingMdx,
      promptMdx: payload.promptMdx,
      storageFields: getChallengeStorageFields(payload),
      choiceOptions: payload.kind === "multiple_choice" ? payload.choiceOptions : [],
      correctChoiceKey: payload.kind === "multiple_choice" ? payload.correctChoiceKey : null,
      choiceExplanationMdx: payload.kind === "multiple_choice" ? payload.choiceExplanationMdx : "",
      saveMode: payload.saveMode
    })

    challengeId = challengeResult.stableRow.id
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save the assignment."
    }
  }

  const [{ data: existingLesson }, { count: lessonCount }] = await Promise.all([
    admin!
      .from("lessons")
      .select("id, order_index, challenge_slug, estimated_minutes, published")
      .eq("course_id", courseId)
      .eq("slug", payload.lessonSlug)
      .maybeSingle(),
    admin!.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId)
  ])

  let lessonId = ""
  try {
    const lessonResult = await saveLessonVersion(admin!, {
      userId: user.id,
      actorEmail: user.email ?? null
    }, {
      courseId,
      courseSlug: payload.courseSlug,
      slug: payload.lessonSlug,
      title: payload.lessonTitle,
      summary: lessonSummary,
      estimatedMinutes: existingLesson?.estimated_minutes ?? 10,
      bodyMdx: payload.bodyMdx,
      orderIndex: existingLesson?.order_index ?? (lessonCount ?? 0) + 1,
      challengeSlug: existingLesson?.challenge_slug ?? challengeSlug,
      saveMode: payload.saveMode
    })

    lessonId = lessonResult.stableRow.id
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save the chapter."
    }
  }

  try {
    const relationResult = await attachChallengeToLesson(admin!, lessonId, challengeId)

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
        .eq("id", lessonId)

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
