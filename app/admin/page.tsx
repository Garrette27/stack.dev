import Link from "next/link"
import { LockKeyhole, WandSparkles } from "lucide-react"

import { AdminAccessCard } from "@/components/admin/admin-access-card"
import { AuthoringForm } from "@/components/admin/authoring-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSnapshot, getCurrentUser, isCurrentUserAdmin } from "@/lib/data"
import { hasJudge0Env, hasSupabaseAdminEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

export default async function AdminPage() {
  const [user, isAdmin, snapshot] = await Promise.all([getCurrentUser(), isCurrentUserAdmin(), getAdminSnapshot()])
  let canClaimFirstAdmin = false

  if (user && !isAdmin && hasSupabaseAdminEnv()) {
    const admin = createAdminClient()
    const { count } = await admin!.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin")
    canClaimFirstAdmin = (count ?? 0) === 0
  }

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="bg-[linear-gradient(160deg,rgba(201,111,54,0.96),rgba(219,145,80,0.92))] text-white">
          <CardHeader>
            <Badge className="w-fit bg-white/12 text-white">Authoring</Badge>
            <CardTitle className="max-w-4xl font-serif text-4xl leading-[1.05] text-white">
              Write the next lesson, prompt, and checker in one place.
            </CardTitle>
            <CardDescription className="text-white/80">
              This page exists to create course content, not explain infrastructure.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/85">
            <p>Minimal flow: write the lesson text, add the coding question, save once, then open the learner page to test it.</p>
            <p>Judge0 is only required when you want the Run check button to execute code for real.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.courses.length}</CardTitle>
              <CardDescription>Courses</CardDescription>
            </CardHeader>
          </Card>
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.lessons.length}</CardTitle>
              <CardDescription>Lessons</CardDescription>
            </CardHeader>
          </Card>
          <Card className="h-full">
            <CardHeader className="h-full justify-between">
              <CardTitle>{snapshot.challenges.length}</CardTitle>
              <CardDescription>Challenges</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <Card
        className={
          snapshot.contentSource === "database"
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/70"
        }
      >
        <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-muted)]">Content source</p>
            <p className="text-lg font-semibold text-[var(--ink-strong)]">
              {snapshot.contentSource === "database" ? "Supabase database live" : "Preview content fallback"}
            </p>
            <p className="text-sm leading-7 text-[var(--ink)]">{snapshot.contentSourceReason}</p>
          </div>
          <div className="grid gap-2 text-sm text-[var(--ink)]">
            <p>{hasSupabaseAdminEnv() ? "Admin save pipeline is configured." : "Admin saving is disabled until service-role env is present."}</p>
            <p>{hasJudge0Env() ? "Judge0 runner env is configured." : "Judge0 runner env is still missing."}</p>
          </div>
        </CardContent>
      </Card>

      {!user ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
              Sign in required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-[var(--ink)]">
            <p>Sign in with the Google account you want to use for authoring.</p>
            <Link href="/login" className="font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]">
              Go to login
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {user && !isAdmin ? <AdminAccessCard canClaimFirstAdmin={canClaimFirstAdmin} /> : null}

      {user && isAdmin ? <AuthoringForm /> : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current content</CardTitle>
            <CardDescription>Open the learner page after each save and verify the exact lesson you just authored.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.lessons.map((lesson) => (
              <div key={lesson.id} className="rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-black/6">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">{lesson.courseSlug}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">{lesson.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{lesson.summary}</p>
                <Link
                  href={`/learn/${lesson.courseSlug}/${lesson.slug}`}
                  className="mt-3 inline-flex text-sm font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]"
                >
                  Open learner view
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WandSparkles className="h-5 w-5 text-[var(--accent)]" />
              How authoring works
            </CardTitle>
            <CardDescription>The content model is small on purpose so you can validate the loop before building a CMS.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-[var(--ink)]">
            <p>A course groups lessons. A lesson contains reading text and summary. A challenge contains the public prompt, starter code, private solution, and hidden tests.</p>
            <p>You do not need Judge0 to write content. You only need it when you want the checker to execute code.</p>
            <p>
              {hasSupabaseAdminEnv()
                ? "Route protection happens on the server: non-admin users can open this page, but only admins can save content."
                : "Saving stays disabled until the project has working Supabase service-role env vars."}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
