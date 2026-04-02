import "server-only"

import { z } from "zod"

import { normalizeMultipleChoiceOptions } from "@/lib/challenges/multiple-choice"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { isSupportedChallengeLanguage } from "@/lib/judge0/languages"
import { createAdminClient } from "@/lib/supabase/admin"
import type { CodeChallengeLanguage, MultipleChoiceOption } from "@/lib/types"
import { slugify } from "@/lib/utils"

export type AuthoringSaveResult = {
  success: boolean
  message: string
}

const authoringBaseSchema = z.object({
  courseTitle: z.string().min(3),
  courseSlug: z.string().min(3),
  lessonTitle: z.string().min(3),
  lessonSlug: z.string().min(3),
  bodyMdx: z.string().min(20),
  challengeSlug: z.string().optional(),
  kind: z.enum(["code", "multiple_choice"]),
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

type AuthoringBundleInput = CodeAuthoringBundleInput | MultipleChoiceAuthoringBundleInput

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

/**
 * Parses and normalizes the authoring form into a single bundle payload.
 */
export function parseAuthoringBundleFormData(formData: FormData): ParsedAuthoringBundle {
  const parsed = authoringBaseSchema.safeParse({
    courseTitle: formData.get("courseTitle"),
    courseSlug: slugify(String(formData.get("courseSlug") ?? "")),
    lessonTitle: formData.get("lessonTitle"),
    lessonSlug: slugify(String(formData.get("lessonSlug") ?? "")),
    bodyMdx: formData.get("bodyMdx"),
    challengeSlug: slugify(String(formData.get("challengeSlug") ?? "")),
    kind: formData.get("kind"),
    language: formData.get("language"),
    judge0LanguageId: formData.get("judge0LanguageId"),
    readingMdx: String(formData.get("readingMdx") ?? ""),
    promptMdx: formData.get("promptMdx"),
    starterCode: formData.get("starterCode"),
    solutionCode: formData.get("solutionCode"),
    hiddenTestCode: formData.get("hiddenTestCode"),
    choiceOptionsJson: String(formData.get("choiceOptionsJson") ?? ""),
    choiceCorrectKey: String(formData.get("choiceCorrectKey") ?? ""),
    choiceExplanationMdx: String(formData.get("choiceExplanationMdx") ?? "")
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
 * Derives a compact chapter summary from the authored reading text so the admin
 * form does not need a second field for the same concept.
 */
function deriveLessonSummary(bodyMdx: string) {
  const firstMeaningfulLine = bodyMdx
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find(Boolean)

  if (!firstMeaningfulLine) {
    return "Practical reading and assignment."
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
 * Persists assignment content while tolerating older databases that have not
 * added the optional reading override column yet.
 */
async function upsertChallengeRecord(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  payload: AuthoringBundleInput,
  challengeSlug: string,
  challengeTitle: string,
  readingMdx: string | null
) {
  const baseChallengeRow = {
    slug: challengeSlug,
    title: challengeTitle,
    kind: payload.kind,
    language: payload.language,
    judge0_language_id: payload.judge0LanguageId,
    prompt_mdx: payload.promptMdx,
    starter_code: payload.starterCode,
    solution_code: payload.solutionCode,
    hidden_test_code: payload.hiddenTestCode,
    choice_options: payload.kind === "multiple_choice" ? payload.choiceOptions : [],
    choice_correct_key: payload.kind === "multiple_choice" ? payload.correctChoiceKey : null,
    choice_explanation_mdx: payload.kind === "multiple_choice" ? payload.choiceExplanationMdx : "",
    published: true
  }

  const fullResult = await admin
    .from("challenges")
    .upsert(
      {
        ...baseChallengeRow,
        reading_mdx: readingMdx
      },
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

  if (!isMissingReadingColumn(fullResult.error) && !isMissingMultipleChoiceColumn(fullResult.error)) {
    return fullResult
  }

  return admin
    .from("challenges")
    .upsert(
      {
        slug: challengeSlug,
        title: challengeTitle,
        language: payload.kind === "code" ? payload.language : "javascript",
        judge0_language_id: payload.kind === "code" ? payload.judge0LanguageId : 102,
        prompt_mdx: payload.promptMdx,
        starter_code: payload.kind === "code" ? payload.starterCode : "",
        solution_code: payload.kind === "code" ? payload.solutionCode : "",
        hidden_test_code: payload.kind === "code" ? payload.hiddenTestCode : "",
        published: true
      },
      {
        onConflict: "slug"
      }
    )
    .select("id")
    .single()
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
  const lessonSummary = deriveLessonSummary(payload.bodyMdx)
  // New assignments default their reading override to the assignment prompt so
  // the learner view can still change per assignment even before a richer
  // assignment-specific explanation is authored.
  const normalizedReadingMdx = payload.readingMdx?.trim() ? payload.readingMdx.trim() : payload.promptMdx.trim()
  const { data: courseRow, error: courseError } = await admin!
    .from("courses")
    .upsert(
      {
        slug: payload.courseSlug,
        title: payload.courseTitle,
        summary: `A practical path into software with ${payload.courseTitle.toLowerCase()}.`,
        difficulty: "Beginner",
        accent: "#c96f36",
        published: true
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
      .select("id, order_index, challenge_slug, estimated_minutes")
      .eq("course_id", courseRow.id)
      .eq("slug", payload.lessonSlug)
      .maybeSingle(),
    admin!.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseRow.id)
  ])

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
      published: true
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
    message: "Chapter and assignment saved."
  }
}
