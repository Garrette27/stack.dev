import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { getSupabaseUrl, hasSupabaseAdminEnv } from "@/lib/env"

export function createAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    return null
  }

  return createSupabaseClient(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
