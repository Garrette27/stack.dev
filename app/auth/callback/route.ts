import { NextResponse } from "next/server"

import { hasSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/dashboard"

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  if (code) {
    const supabase = await createClient()
    await supabase?.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
