import { NextResponse } from "next/server"

import { hasSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  if (hasSupabaseEnv()) {
    const supabase = await createClient()
    await supabase?.auth.signOut()
  }

  return NextResponse.redirect(new URL("/", new URL(request.url).origin))
}
