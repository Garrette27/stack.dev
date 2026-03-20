import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseBrowserKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/env"

type CookieMutation = {
  name: string
  value: string
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2]
}

export async function createClient() {
  if (!hasSupabaseEnv()) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieMutation[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components may attempt a refresh where setting cookies is not allowed.
          // Middleware handles the refresh path in those cases.
        }
      }
    }
  })
}
