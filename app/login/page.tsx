import { ArrowRight, CheckCircle2 } from "lucide-react"

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1880px] items-center px-4 py-16 sm:px-6 xl:px-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <Badge>Google sign-in via Supabase Auth</Badge>
          <h1 className="max-w-2xl font-serif text-5xl tracking-tight text-[var(--ink-strong)]">
            Sign in once and keep every lesson exactly where you left it.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[var(--ink)]">
            You do not need Firebase for this. Supabase can use Google OAuth directly, and your progress tables can stay
            in the same Postgres project.
          </p>
          <div className="grid gap-3 text-sm text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Google login handled by Supabase Auth</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Progress stored in the same Supabase Postgres database</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Admin authoring unlocked by setting your profile role to admin</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Continue into your dashboard
              <ArrowRight className="h-5 w-5 text-[var(--accent)]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-7 text-[var(--ink-muted)]">
              Configure Google in Supabase Auth, set your callback URL, then use the button below.
            </p>
            <GoogleSignInButton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
