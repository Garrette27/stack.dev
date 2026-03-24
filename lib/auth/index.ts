import { hasSupabaseEnv } from "@/lib/env"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return null
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  return user
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser()
  if (!user) {
    return false
  }

  if (!hasSupabaseEnv()) {
    return true
  }

  const supabase = await createServerClient()
  const { data } = await supabase!
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return data?.role === "admin"
}
