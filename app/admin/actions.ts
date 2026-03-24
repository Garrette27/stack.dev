"use server"

import { revalidatePath } from "next/cache"

import {
  claimAdminAccessForCurrentUser,
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
    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath(`/learn/${parsed.data.courseSlug}`)
    revalidatePath(`/learn/${parsed.data.courseSlug}/${parsed.data.lessonSlug}`)
    revalidatePath("/admin")
  }

  return result
}
