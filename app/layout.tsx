import type { Metadata } from "next"
import { Space_Grotesk, Source_Serif_4 } from "next/font/google"
import { Suspense, type ReactNode } from "react"

import { PageHitTracker } from "@/components/analytics/page-hit-tracker"
import { SiteHeader } from "@/components/navigation/site-header"
import { ThemeScript } from "@/components/theme/theme-script"
import { cn } from "@/lib/utils"

import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif"
})

export const metadata: Metadata = {
  title: "stack.dev.ph",
  description: "A practice-first coding platform built around short reading, practical reps, and steady progress."
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark" style={{ colorScheme: "dark" }}>
      <head>
        <ThemeScript />
      </head>
      <body className={cn(spaceGrotesk.variable, sourceSerif.variable, "font-sans")}>
        <div className="relative min-h-screen">
          <Suspense fallback={null}>
            <PageHitTracker />
          </Suspense>
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
