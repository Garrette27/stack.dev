import type { Metadata } from "next"
import { Space_Grotesk, Source_Serif_4 } from "next/font/google"
import type { ReactNode } from "react"

import { SiteHeader } from "@/components/navigation/site-header"
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
  description: "A text-first coding practice scaffold inspired by the learning loop you want to build."
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={cn(spaceGrotesk.variable, sourceSerif.variable, "font-sans")}>
        <div className="relative min-h-screen">
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
