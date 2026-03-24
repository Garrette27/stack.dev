import "server-only"

import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth"
import { hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ContentSnapshot } from "@/lib/types"

import { getAdminSnapshot } from "./snapshot"

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
