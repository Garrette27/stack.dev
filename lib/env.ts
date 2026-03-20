const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseBrowserKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseBrowserKey)
}

export function hasSupabaseAdminEnv() {
  return hasSupabaseEnv() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function hasJudge0Env() {
  return Boolean(process.env.JUDGE0_API_URL)
}

export function getSupabaseUrl() {
  return supabaseUrl
}

export function getSupabaseBrowserKey() {
  return supabaseBrowserKey
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
