"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type SiteHeaderNavProps = {
  showAuthoring: boolean
  isAdmin: boolean
}

const linkBaseClassName =
  "rounded-full px-3 py-2 text-sm transition"

function getLinkStateClassName(active: boolean) {
  return active
    ? "bg-white text-[var(--ink-strong)] shadow-[0_8px_24px_rgba(25,31,45,0.08)] ring-1 ring-black/8"
    : "text-[var(--ink-muted)] hover:bg-white/70 hover:text-[var(--ink-strong)]"
}

export function SiteHeaderNav({ showAuthoring, isAdmin }: SiteHeaderNavProps) {
  const pathname = usePathname()

  const items = [
    { href: "/dashboard", label: "Dashboard", active: pathname === "/dashboard" },
    { href: "/learn", label: "Learn", active: pathname.startsWith("/learn") },
    { href: "/pricing", label: "Pricing", active: pathname === "/pricing" }
  ]

  return (
    <nav className="hidden items-center gap-2 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(linkBaseClassName, getLinkStateClassName(item.active))}
        >
          {item.label}
        </Link>
      ))}

      <a
        href="https://blog-app-flutter.vercel.app/"
        target="_blank"
        rel="noreferrer"
        className={cn(linkBaseClassName, getLinkStateClassName(false))}
      >
        Blog
      </a>

      {showAuthoring ? (
        <Link
          href="/admin"
          aria-current={pathname === "/admin" ? "page" : undefined}
          className={cn(linkBaseClassName, getLinkStateClassName(pathname === "/admin"))}
        >
          {isAdmin ? "Admin" : "Authoring"}
        </Link>
      ) : null}
    </nav>
  )
}
