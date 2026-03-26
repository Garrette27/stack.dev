import "server-only"

import { z } from "zod"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { slugify } from "@/lib/utils"

export type AuthoringSaveResult = {
  success: boolean
  message: string
}

const authoringSchema = z.object({
  courseTitle: z.string().min(3),
  courseSlug: z.string().min(3),
  lessonTitle: z.string().min(3),
  lessonSlug: z.string().min(3),
  lessonSummary: z.string().min(8),
  bodyMdx: z.string().min(20),
  challengeSlug: z.string().optional(),
  language: z.enum(["python", "javascript"]),
  judge0LanguageId: z.coerce.number().int().min(1),
  promptMdx: z.string().min(10),
  starterCode: z.string().min(5),
  solutionCode: z.string().min(5),
  hiddenTestCode: z.string().min(5)
})

type AuthoringBundleInput = z.infer<typeof authoringSchema>

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

/**
 * Parses and normalizes the authoring form into a single bundle payload.
 */
export function parseAuthoringBundleFormData(formData: FormData): ParsedAuthoringBundle {
  const parsed = authoringSchema.safeParse({
    courseTitle: formData.get("courseTitle"),
    courseSlug: slugify(String(formData.get("courseSlug") ?? "")),
    lessonTitle: formData.get("lessonTitle"),
    lessonSlug: slugify(String(formData.get("lessonSlug") ?? "")),
    lessonSummary: formData.get("lessonSummary"),
    bodyMdx: formData.get("bodyMdx"),
    challengeSlug: slugify(String(formData.get("challengeSlug") ?? "")),
    language: formData.get("language"),
    judge0LanguageId: formData.get("judge0LanguageId"),
    promptMdx: formData.get("promptMdx"),
    starterCode: formData.get("starterCode"),
    solutionCode: formData.get("solutionCode"),
    hiddenTestCode: formData.get("hiddenTestCode")
  })

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid form payload."
    }
  }

  return {
    success: true,
    data: parsed.data
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
  const { data: challengeRow, error: challengeError } = await admin!.from("challenges").upsert(
    {
      slug: challengeSlug,
      title: challengeTitle,
      language: payload.language,
      judge0_language_id: payload.judge0LanguageId,
      prompt_mdx: payload.promptMdx,
      starter_code: payload.starterCode,
      solution_code: payload.solutionCode,
      hidden_test_code: payload.hiddenTestCode,
      published: true
    },
    {
      onConflict: "slug"
    }
  ).select("id")
   .single()

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
      summary: payload.lessonSummary,
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
