"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/data"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { slugify } from "@/lib/utils"

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

export type AuthoringActionState = {
  success: boolean
  message: string
}

export type AdminAccessActionState = {
  success: boolean
  message: string
}

export async function claimAdminAccessAction(
  _prevState: AdminAccessActionState,
  _formData: FormData
): Promise<AdminAccessActionState> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      success: false,
      message: "Sign in with the Google account you want to use for authoring first."
    }
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      message: "Supabase admin env is missing, so authoring access cannot be claimed yet."
    }
  }

  if (await isCurrentUserAdmin()) {
    return {
      success: true,
      message: "This account already has authoring access."
    }
  }

  const supabase = createAdminClient()

  const { count: adminCount, error: adminCountError } = await supabase!
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")

  if (adminCountError) {
    return {
      success: false,
      message: adminCountError.message
    }
  }

  if ((adminCount ?? 0) > 0) {
    return {
      success: false,
      message: "An admin account already exists. Sign in with that account or promote this account in the profiles table."
    }
  }

  const { error: upsertError } = await supabase!.from("profiles").upsert(
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

  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath("/admin")

  return {
    success: true,
    message: "This account is now the first admin. The authoring form is unlocked."
  }
}

export async function upsertAuthoringBundleAction(
  _prevState: AuthoringActionState,
  formData: FormData
): Promise<AuthoringActionState> {
  const user = await getCurrentUser()
  const admin = user ? await isCurrentUserAdmin() : false

  if (!user) {
    return {
      success: false,
      message: "Sign in first."
    }
  }

  if (!admin) {
    return {
      success: false,
      message: "Your profile role must be set to admin before this form can save content."
    }
  }

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

  if (!hasSupabaseAdminEnv()) {
    return {
      success: false,
      message: "Supabase service role env is missing. The admin UI is scaffolded, but saving needs a real Supabase project."
    }
  }

  const payload = parsed.data
  const supabase = createAdminClient()

  const { data: courseRow, error: courseError } = await supabase!
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

  const { error: challengeError } = await supabase!.from("challenges").upsert(
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

  const { data: existingLesson } = await supabase!
    .from("lessons")
    .select("order_index")
    .eq("course_id", courseRow.id)
    .eq("slug", payload.lessonSlug)
    .maybeSingle()

  const { count: lessonCount } = await supabase!
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseRow.id)

  const { error: lessonError } = await supabase!.from("lessons").upsert(
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

  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath(`/learn/${payload.courseSlug}`)
  revalidatePath(`/learn/${payload.courseSlug}/${payload.lessonSlug}`)
  revalidatePath("/admin")

  return {
    success: true,
    message: "Lesson and challenge saved."
  }
}
