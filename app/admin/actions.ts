"use server"

import { revalidatePath } from "next/cache"

import {
  claimAdminAccessForCurrentUser,
  deleteChallengeForCurrentUser,
  deleteCourseForCurrentUser,
  deleteLessonForCurrentUser,
  parseAuthoringBundleFormData,
  saveAuthoringBundleForCurrentUser
} from "@/lib/admin"

export type AuthoringActionState = {
  success: boolean
  message: string
}

export type AdminAccessActionState = {
  success: boolean
  message: string
}

async function revalidateContentPaths(courseSlug: string, lessonSlug?: string) {
  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath("/learn")
  revalidatePath(`/learn/${courseSlug}`)
  if (lessonSlug) {
    revalidatePath(`/learn/${courseSlug}/${lessonSlug}`)
  }
  revalidatePath("/admin")
}

export async function claimAdminAccessAction(
  _prevState: AdminAccessActionState,
  _formData: FormData
): Promise<AdminAccessActionState> {
  const result = await claimAdminAccessForCurrentUser()

  if (result.success) {
    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/admin")
  }

  return result
}

export async function upsertAuthoringBundleAction(
  _prevState: AuthoringActionState,
  formData: FormData
): Promise<AuthoringActionState> {
  const parsed = parseAuthoringBundleFormData(formData)

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.message
    }
  }

  const result = await saveAuthoringBundleForCurrentUser(parsed.data)

  if (result.success) {
    await revalidateContentPaths(parsed.data.courseSlug, parsed.data.lessonSlug)
  }

  return result
}

export async function deleteCourseAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const result = await deleteCourseForCurrentUser(courseSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
  }
}

export async function deleteLessonAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const result = await deleteLessonForCurrentUser(courseSlug, lessonSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function deleteChallengeAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const result = await deleteChallengeForCurrentUser(challengeSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}
