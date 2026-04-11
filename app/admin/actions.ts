"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  claimAdminAccessForCurrentUser,
  parseAuthoringBundleFormData,
  saveAuthoringBundleForCurrentUser
} from "@/lib/admin"
import {
  type CatalogImportDestination,
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

function resolveCatalogImportDestination(formData: FormData):
  | { success: true; destination: CatalogImportDestination }
  | { success: false; message: string } {
  const requestedScope = String(formData.get("destinationScope") ?? "new_course")
  const targetCourseSlug = String(formData.get("targetCourseSlug") ?? "").trim()
  const targetLessonSlug = String(formData.get("targetLessonSlug") ?? "").trim()

  if (requestedScope === "existing_lesson") {
    if (!targetCourseSlug || !targetLessonSlug) {
      return {
        success: false,
        message: "Pick the chapter that should receive these imported assignments first."
      }
    }

    return {
      success: true,
      destination: {
        scope: "existing_lesson",
        courseSlug: targetCourseSlug,
        lessonSlug: targetLessonSlug
      }
    }
  }

  if (requestedScope === "existing_course") {
    if (!targetCourseSlug) {
      return {
        success: false,
        message: "Pick the course that should receive these imported chapters first."
      }
    }

    return {
      success: true,
      destination: {
        scope: "existing_course",
        courseSlug: targetCourseSlug
      }
    }
  }

  return {
    success: true,
    destination: {
      scope: "new_course"
    }
  }
}

function buildAdminSelectionHref(selection: {
  courseSlug?: string
  lessonSlug?: string
  challengeSlug?: string
}) {
  const params = new URLSearchParams()

  if (selection.courseSlug) {
    params.set("authorCourse", selection.courseSlug)
  }

  if (selection.lessonSlug) {
    params.set("authorLesson", selection.lessonSlug)
  }

  if (selection.challengeSlug) {
    params.set("authorAssignment", selection.challengeSlug)
  }

  const query = params.toString()
  return query ? `/admin?${query}` : "/admin"
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
    redirect(buildAdminSelectionHref({ courseSlug }))
  }
}

export async function setLessonVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setLessonVisibilityForCurrentUser(courseSlug, lessonSlug, nextVisibility !== "hidden")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug }))
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
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug, challengeSlug }))
  }
}

export async function setCourseTreeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setCourseTreeVisibilityForCurrentUser(courseSlug, nextVisibility === "visible")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
    redirect(buildAdminSelectionHref({ courseSlug }))
  }
}

export async function setLessonTreeVisibilityAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const nextVisibility = String(formData.get("visibility") ?? "")
  const result = await setLessonTreeVisibilityForCurrentUser(courseSlug, lessonSlug, nextVisibility === "visible")

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug }))
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
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug, challengeSlug }))
  }
}

export async function duplicateAssignmentAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const challengeSlug = String(formData.get("challengeSlug") ?? "")
  const result = await duplicateChallengeForCurrentUser(courseSlug, lessonSlug, challengeSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug, challengeSlug }))
  }
}

export async function duplicateChapterAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const result = await duplicateLessonForCurrentUser(courseSlug, lessonSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug }))
  }
}

export async function cloneCourseAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const result = await cloneCourseForCurrentUser(courseSlug)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug)
    revalidatePath("/learn")
    redirect(buildAdminSelectionHref({ courseSlug }))
  }
}

export async function reorderLessonAction(formData: FormData) {
  const courseSlug = String(formData.get("courseSlug") ?? "")
  const lessonSlug = String(formData.get("lessonSlug") ?? "")
  const direction = String(formData.get("direction") ?? "") as "up" | "down"
  const result = await moveLessonForCurrentUser(courseSlug, lessonSlug, direction)

  if (result.success && courseSlug) {
    await revalidateContentPaths(courseSlug, lessonSlug)
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug }))
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
    redirect(buildAdminSelectionHref({ courseSlug, lessonSlug, challengeSlug }))
  }
}

export async function importCatalogManifestAction(
  _prevState: AdminImportActionState,
  formData: FormData
): Promise<AdminImportActionState> {
  const manifestSource = String(formData.get("manifestSource") ?? "")
  const saveMode = String(formData.get("saveMode") ?? "draft") as "draft" | "publish"
  const destinationResult = resolveCatalogImportDestination(formData)

  if (!destinationResult.success) {
    return {
      success: false,
      message: destinationResult.message
    }
  }

  const result = await importCatalogManifestForCurrentUser(manifestSource, saveMode, destinationResult.destination)

  if (result.success) {
    if (result.selection?.courseSlug) {
      await revalidateContentPaths(result.selection.courseSlug, result.selection.lessonSlug)
      redirect(buildAdminSelectionHref(result.selection))
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/learn")
    revalidatePath("/admin")
    redirect("/admin")
  }

  return result
}
