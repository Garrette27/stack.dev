import Link from "next/link"
import { ArrowRight, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/data"
import { getCurrentSubscriptionAccess, getPrimaryPlan } from "@/lib/billing"

function formatRenewalDate(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium"
  }).format(new Date(value))
}

export default async function BillingPage() {
  const [user, access, plan] = await Promise.all([
    getCurrentUser(),
    getCurrentSubscriptionAccess(),
    Promise.resolve(getPrimaryPlan())
  ])
  const renewalDate = formatRenewalDate(access.currentPeriodEnd)

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-8 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>Billing</Badge>
        <h1 className="max-w-4xl font-serif text-5xl tracking-tight text-[var(--ink-strong)]">
          Subscription setup for your course catalog.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">
          The checkout backend is not connected yet, but this page now holds the public subscription UI and account state
          so we can wire payments in later without redesigning the flow.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden bg-[linear-gradient(160deg,rgba(201,111,54,0.96),rgba(219,145,80,0.92))] text-white">
          <CardHeader className="border-b border-white/12">
            <CardTitle className="font-serif text-4xl leading-[1.05] text-white">{plan.name}</CardTitle>
            <CardDescription className="text-white/82">{plan.tagline}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="rounded-[1.5rem] bg-white/12 p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">{plan.cadenceLabel}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{plan.priceLabel}</p>
              <p className="mt-3 text-sm leading-7 text-white/82">
                Built for learners who want practical reps, real exercises, and a session rhythm that survives a busy week.
              </p>
            </div>

            <div className="grid gap-3 text-sm leading-7 text-white/85">
              {plan.highlights.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-white" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[var(--accent)]" />
              Account status
            </CardTitle>
            <CardDescription>
              This is the UI we will keep when checkout and webhooks are connected later.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm leading-7 text-[var(--ink)]">
            {!user ? (
              <div className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-5">
                <p className="flex items-center gap-2 font-semibold text-[var(--ink-strong)]">
                  <LockKeyhole className="h-4 w-4 text-[var(--accent)]" />
                  Sign in first
                </p>
                <p className="mt-2 text-[var(--ink-muted)]">
                  Sign in before checkout is connected so your subscription can be attached to the correct account.
                </p>
              </div>
            ) : access.status === "active" ? (
              <div className="rounded-[1.5rem] bg-[color:rgb(201_111_54/0.08)] p-5">
                <p className="font-semibold text-[var(--ink-strong)]">Active subscription</p>
                <p className="mt-2 text-[var(--ink-muted)]">
                  {renewalDate ? `Your access is active and currently renews around ${renewalDate}.` : "Your access is active."}
                </p>
              </div>
            ) : (
              <div className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] p-5">
                <p className="font-semibold text-[var(--ink-strong)]">Ready for checkout</p>
                <p className="mt-2 text-[var(--ink-muted)]">
                  Your account is signed in. The next step is wiring the checkout provider and webhook flow.
                </p>
              </div>
            )}

            <div className="grid gap-3 rounded-[1.5rem] border border-dashed border-black/12 bg-white/70 p-5">
              <p className="font-semibold text-[var(--ink-strong)]">Checkout preview</p>
              <p className="text-[var(--ink-muted)]">
                This button stays disabled until the payment provider, checkout session, and webhook status sync are live.
              </p>
              <Button disabled>
                Checkout integration coming soon
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/pricing">
                <Button variant="secondary">Back to pricing</Button>
              </Link>
              <Link href={access.status === "active" ? "/learn" : "/dashboard"}>
                <Button variant="ghost">
                  {access.status === "active" ? "Open your course catalog" : "Return to dashboard"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
