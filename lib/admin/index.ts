import "server-only"

import { z } from "zod"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { mockContent } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Challenge, ContentSnapshot } from "@/lib/types"
import { slugify } from "@/lib/utils"

import { loadSnapshotFromRows } from "@/lib/content/snapshot-loader"
import { createMockSnapshot, mapChallenge } from "@/lib/content/shared"

export type AdminPageState = {
  user: Awaited<ReturnType<typeof getCurrentUser>>
  isAdmin: boolean
  canClaimFirstAdmin: boolean
  snapshot: ContentSnapshot
}

export type AdminAccessResult = {
  success: boolean
  message: string
}

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
  estimatedMinutes: z.coerce.number().int().min(1),
  bodyMdx: z.string().min(20),
  challengeTitle: z.string().min(3),
  challengeSlug: z.string().min(3),
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

async function getAdminCount() {
  const admin = createAdminClient()
  const { count, error } = await admin!.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin")

  return {
    count: count ?? 0,
    error
  }
}

/**
 * Returns the complete admin page state so the page component only renders.
 */
export async function getAdminPageState(): Promise<AdminPageState> {
  const [user, isAdmin, snapshot] = await Promise.all([getCurrentUser(), isCurrentUserAdmin(), getAdminSnapshot()])
  let canClaimFirstAdmin = false

  if (user && !isAdmin && hasSupabaseAdminEnv()) {
    const { count } = await getAdminCount()
    canClaimFirstAdmin = count === 0
  }

  return {
    user,
    isAdmin,
    canClaimFirstAdmin,
    snapshot
  }
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
    estimatedMinutes: formData.get("estimatedMinutes"),
    bodyMdx: formData.get("bodyMdx"),
    challengeTitle: formData.get("challengeTitle"),
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
 * Claims the first admin account for the currently signed-in user.
 */
export async function claimAdminAccessForCurrentUser(): Promise<AdminAccessResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: "Sign in with the account you want to use for authoring first."
    }
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      message: "Authoring access cannot be claimed until admin access is configured for this project."
    }
  }

  if (await isCurrentUserAdmin()) {
    return {
      success: true,
      message: "This account already has authoring access."
    }
  }

  const { count: adminCount, error: adminCountError } = await getAdminCount()
  if (adminCountError) {
    return {
      success: false,
      message: adminCountError.message
    }
  }

  if (adminCount > 0) {
    return {
      success: false,
      message: "An author account already exists for this project. Use that account to continue."
    }
  }

  const admin = createAdminClient()
  const { error: upsertError } = await admin!.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
      role: "admin"
    },
    {
      onConflict: "id"
    }
  )

  if (upsertError) {
    return {
      success: false,
      message: upsertError.message
    }
  }

  return {
    success: true,
    message: "This account can now create and edit lessons."
  }
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
  const { data: courseRow, error: courseError } = await admin!
    .from("courses")
    .upsert(
      {
        slug: payload.courseSlug,
        title: payload.courseTitle,
        summary: `A focused path for ${payload.courseTitle.toLowerCase()}.`,
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

  const { error: challengeError } = await admin!.from("challenges").upsert(
    {
      slug: payload.challengeSlug,
      title: payload.challengeTitle,
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
  )

  if (challengeError) {
    return {
      success: false,
      message: challengeError.message
    }
  }

  const [{ data: existingLesson }, { count: lessonCount }] = await Promise.all([
    admin!.from("lessons").select("order_index").eq("course_id", courseRow.id).eq("slug", payload.lessonSlug).maybeSingle(),
    admin!.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseRow.id)
  ])

  const { error: lessonError } = await admin!.from("lessons").upsert(
    {
      course_id: courseRow.id,
      slug: payload.lessonSlug,
      title: payload.lessonTitle,
      summary: payload.lessonSummary,
      estimated_minutes: payload.estimatedMinutes,
      body_mdx: payload.bodyMdx,
      challenge_slug: payload.challengeSlug,
      order_index: existingLesson?.order_index ?? (lessonCount ?? 0) + 1,
      published: true
    },
    {
      onConflict: "course_id,slug"
    }
  )

  if (lessonError) {
    return {
      success: false,
      message: lessonError.message
    }
  }

  return {
    success: true,
    message: "Lesson and challenge saved."
  }
}

/**
 * Returns a challenge payload that can be executed by the submission runner.
 */
export async function getRunnerChallengeBySlug(challengeSlug: string): Promise<Challenge | null> {
  if (!hasSupabaseAdminEnv()) {
    return mockContent.challenges.find((item) => item.slug === challengeSlug) ?? null
  }

  const admin = createAdminClient()
  const { data } = await admin!.from("challenges").select("*").eq("slug", challengeSlug).maybeSingle()

  if (!data) {
    return null
  }

  return mapChallenge(data as Record<string, unknown>)
}

/**
 * Returns all authored content visible to the admin surface.
 */
export async function getAdminSnapshot(): Promise<ContentSnapshot> {
  return loadSnapshotFromRows({
    emptyMode: "database",
    emptyContentReason: "No courses or lessons have been created yet.",
    contentSourceReason: "Live project content",
    loadRows: async () => {
      if (!hasSupabaseAdminEnv()) {
        return {
          rows: {},
          fallbackReason: "Authoring preview is showing because admin access is not configured for this project."
        }
      }

      const admin = createAdminClient()
      const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }] = await Promise.all([
        admin!.from("courses").select("*").order("title"),
        admin!.from("lessons").select("*").order("order_index"),
        admin!.from("challenges").select("*").order("title")
      ])

      return {
        rows: {
          courseRows: (courseRows ?? []) as Record<string, unknown>[],
          lessonRows: (lessonRows ?? []) as Record<string, unknown>[],
          challengeRows: (challengeRows ?? []) as Record<string, unknown>[]
        }
      }
    }
  })
}
