import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { SiteHeaderNav } from "@/components/navigation/site-header-nav"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/data"

export async function SiteHeader() {
  const user = await getCurrentUser()
  const isAdmin = user ? await isCurrentUserAdmin() : false

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--header-surface)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--ink-strong)]">
            stack.dev.ph
          </Link>
          <SiteHeaderNav showAuthoring={Boolean(user) && isAdmin} isAdmin={isAdmin} />
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-[var(--ink-strong)]">
                  {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">{isAdmin ? "Admin authoring enabled" : "Learner mode"}</p>
              </div>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="hidden rounded-full bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-[var(--ink-strong)] ring-1 ring-[var(--border-subtle)] md:inline-flex"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Author
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
