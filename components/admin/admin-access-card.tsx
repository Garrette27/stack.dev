"use client"

import { useActionState } from "react"
import { LockKeyhole, ShieldCheck } from "lucide-react"

import { claimAdminAccessAction, type AdminAccessActionState } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const initialState: AdminAccessActionState = {
  success: false,
  message: ""
}

type AdminAccessCardProps = {
  canClaimFirstAdmin: boolean
}

export function AdminAccessCard({ canClaimFirstAdmin }: AdminAccessCardProps) {
  const [state, formAction, pending] = useActionState(claimAdminAccessAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {canClaimFirstAdmin ? (
            <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          ) : (
            <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
          )}
          {canClaimFirstAdmin ? "Claim authoring access" : "Authoring is locked for this account"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-7 text-[var(--ink)]">
        {canClaimFirstAdmin ? (
          <>
            <p>No admin account exists yet. Make this signed-in account the first admin, then start writing lessons immediately.</p>
            <form action={formAction} className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Unlocking..." : "Make this account admin"}
              </Button>
              {state.message ? (
                <p className={state.success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>
              ) : null}
            </form>
          </>
        ) : (
          <>
            <p>An admin account already exists for this project.</p>
            <p>Use that account to author content, or promote this account in the `profiles` table if you want it to write lessons too.</p>
            {state.message ? <p className="text-sm text-rose-700">{state.message}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
