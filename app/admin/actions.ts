"use server"

import { revalidatePath } from "next/cache"

import {
  archiveChallengeForCurrentUser,
  claimAdminAccessForCurrentUser,
  hideCourseForCurrentUser,
  hideLessonForCurrentUser,
  parseAuthoringBundleFormData,
  restoreChallengeForCurrentUser,
  restoreCourseForCurrentUser,
  restoreLessonForCurrentUser,
  saveAuthoringBundleForCurrentUser
} from "@/lib/admin"

export type AuthoringActionState = {
  success: boolean
  message: string
  savedCourseSlug?: string
  savedLessonSlug?: string
  savedChallengeSlug?: string
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

export async function setCourseVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result =
    nextVisibility === "hidden"
      ? await hideCourseForCurrentUser(courseSlug)
      : await restoreCourseForCurrentUser(courseSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
  }
}

export async function setLessonVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result =
    nextVisibility === "hidden"
      ? await hideLessonForCurrentUser(courseSlug, lessonSlug)
      : await restoreLessonForCurrentUser(courseSlug, lessonSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function setChallengeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result =
    nextVisibility === "hidden"
      ? await archiveChallengeForCurrentUser(challengeSlug)
      : await restoreChallengeForCurrentUser(challengeSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}
