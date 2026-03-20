"use client"

import { useState, useTransition } from "react"
import { Chrome, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type GoogleSignInButtonProps = {
  next?: string
}

export function GoogleSignInButton({ next = "/dashboard" }: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSignIn = () => {
    startTransition(async () => {
      setError(null)

      const supabase = createClient()
      if (!supabase) {
        setError("Supabase is not configured yet. Add the env vars and enable Google in Supabase Auth.")
        return
      }

      const redirectTo = new URL("/auth/callback", window.location.origin)
      redirectTo.searchParams.set("next", next)

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString()
        }
      })

      if (signInError) {
        setError(signInError.message)
      }
    })
  }

  return (
    <div className="grid gap-3">
      <Button variant="accent" size="lg" type="button" onClick={handleSignIn} disabled={pending}>
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4" />}
        Continue with Google
      </Button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  )
}
