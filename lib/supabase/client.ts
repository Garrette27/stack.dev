"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseBrowserKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/env"

let browserClient:
  | ReturnType<typeof createBrowserClient>
  | null = null

export function createClient() {
  if (!hasSupabaseEnv()) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseBrowserKey())
  }

  return browserClient
}
