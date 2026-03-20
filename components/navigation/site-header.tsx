import Link from "next/link"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/data"

export async function SiteHeader() {
  const user = await getCurrentUser()
  const isAdmin = user ? await isCurrentUserAdmin() : false

  return (
    <header className="sticky top-0 z-30 border-b border-black/6 bg-[color:rgb(247_241_233/0.78)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--ink-strong)]">
            stack.dev.ph
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-[var(--ink-muted)] md:flex">
            <Link href="/dashboard" className="transition hover:text-[var(--ink-strong)]">
              Dashboard
            </Link>
            <Link href="/learn/backend-foundations" className="transition hover:text-[var(--ink-strong)]">
              Learn
            </Link>
            <Link href="/pricing" className="transition hover:text-[var(--ink-strong)]">
              Pricing
            </Link>
            {user ? (
              <Link href="/admin" className="transition hover:text-[var(--ink-strong)]">
                {isAdmin ? "Admin" : "Authoring"}
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-[var(--ink-strong)]">
                  {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">{isAdmin ? "Admin authoring enabled" : "Learner mode"}</p>
              </div>
              {user ? (
                <Link
                  href="/admin"
                  className="hidden rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink-strong)] ring-1 ring-black/8 md:inline-flex"
                >
                  {isAdmin ? <ShieldCheck className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                  {isAdmin ? "Author" : "Authoring"}
                </Link>
              ) : null}
              <form action="/auth/signout" method="post">
                <Button variant="secondary" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button variant="accent">
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
