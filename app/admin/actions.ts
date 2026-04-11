"use server"

import { revalidatePath } from "next/cache"

import {
  claimAdminAccessForCurrentUser,
  parseAuthoringBundleFormData,
  saveAuthoringBundleForCurrentUser
} from "@/lib/admin"
import {
  cloneCourseForCurrentUser,
  duplicateChallengeForCurrentUser,
  duplicateLessonForCurrentUser,
  importCatalogManifestForCurrentUser,
  moveChallengeForCurrentUser,
  moveLessonForCurrentUser,
  restoreChallengeVersionAsDraftForCurrentUser,
  restoreCourseVersionAsDraftForCurrentUser,
  restoreLessonVersionAsDraftForCurrentUser,
  setChallengeVisibilityForCurrentUser,
  setCourseTreeVisibilityForCurrentUser,
  setCourseVisibilityForCurrentUser,
  setLessonTreeVisibilityForCurrentUser,
  setLessonVisibilityForCurrentUser
} from "@/lib/admin/catalog-workflows"

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

export type AdminImportActionState = {
  success: boolean
  message: string
}

async function revalidateContentPaths(courseSlug: string, lessonSlug?: string) {
  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath("/learn")
  revalidatePath(`/learn/${courseSlug}`)
  revalidatePath(`/learn/${courseSlug}/practice`)
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
  const result = await setCourseVisibilityForCurrentUser(courseSlug, nextVisibility !== "hidden")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
  }
}

export async function setLessonVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setLessonVisibilityForCurrentUser(courseSlug, lessonSlug, nextVisibility !== "hidden")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function setChallengeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setChallengeVisibilityForCurrentUser(challengeSlug, nextVisibility !== "hidden")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function setCourseTreeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setCourseTreeVisibilityForCurrentUser(courseSlug, nextVisibility === "visible")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
  }
}

export async function setLessonTreeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setLessonTreeVisibilityForCurrentUser(courseSlug, lessonSlug, nextVisibility === "visible")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function restoreVersionAction(formData: FormData) {
  const contentType = String(formData.get("contentType") ?? "")
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const versionId = String(formData.get("versionId") ?? "")

  const result =
    contentType === "course"
      ? await restoreCourseVersionAsDraftForCurrentUser(courseSlug, versionId)
      : contentType === "lesson"
        ? await restoreLessonVersionAsDraftForCurrentUser(courseSlug, lessonSlug, versionId)
        : await restoreChallengeVersionAsDraftForCurrentUser(challengeSlug, versionId)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug || undefined)
  }
}

export async function duplicateAssignmentAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const result = await duplicateChallengeForCurrentUser(courseSlug, lessonSlug, challengeSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function duplicateChapterAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const result = await duplicateLessonForCurrentUser(courseSlug, lessonSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function cloneCourseAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const result = await cloneCourseForCurrentUser(courseSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
    revalidatePath("/learn")
  }
}

export async function reorderLessonAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const direction = String(formData.get("direction") ?? "") as "up" | "down"
  const result = await moveLessonForCurrentUser(courseSlug, lessonSlug, direction)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function reorderAssignmentAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const direction = String(formData.get("direction") ?? "") as "up" | "down"
  const result = await moveChallengeForCurrentUser(courseSlug, lessonSlug, challengeSlug, direction)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
  }
}

export async function importCatalogManifestAction(
  _prevState: AdminImportActionState,
  formData: FormData
): Promise<AdminImportActionState> {
  const manifestSource = String(formData.get("manifestSource") ?? "")
  const saveMode = String(formData.get("saveMode") ?? "draft") as "draft" | "publish"
  const result = await importCatalogManifestForCurrentUser(manifestSource, saveMode)

  if (result.success) {
    revalidatePath("/")
    revalidatePath("/learn")
    revalidatePath("/admin")
  }

  return result
}
