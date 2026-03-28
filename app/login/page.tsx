import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/data"

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1880px] items-center px-4 py-16 sm:px-6 xl:px-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <Badge>Sign in</Badge>
          <h1 className="max-w-2xl font-serif text-5xl tracking-tight text-[var(--ink-strong)]">
            Sign in once and keep every lesson exactly where you left it.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[var(--ink)]">
            Continue with Google to save your progress, return to your active lesson, and keep your learning history in one
            place.
          </p>
          <div className="grid gap-3 text-sm text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Pick up where you left off on any signed-in visit</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Keep lesson progress and resume state synced to your account</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
              <span>Open your dashboard immediately after sign-in</span>
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
            <p className="text-sm leading-7 text-[var(--ink-muted)]">Use your Google account to continue.</p>
            <GoogleSignInButton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
