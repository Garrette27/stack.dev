import Link from "next/link"
import { ArrowRight, Briefcase, Clock3, ShieldCheck, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentSubscriptionAccess, getPrimaryBillingCta, getPrimaryPlan } from "@/lib/billing"

const reasonsToJoin = [
  {
    title: "Built around practical sessions",
    description: "Each session is shaped to get you reading, coding, and moving again without wasting time on filler.",
    icon: Briefcase
  },
  {
    title: "Made for busy schedules",
    description: "Study in focused sessions instead of trying to block out huge chunks of time you do not have.",
    icon: Clock3
  },
  {
    title: "Practice, not just theory",
    description: "Read a concept, solve a problem, and keep moving. The product is built around momentum.",
    icon: Sparkles
  }
]

export default async function PricingPage() {
  const plan = getPrimaryPlan()
  const subscriptionAccess = await getCurrentSubscriptionAccess()
  const primaryCta = getPrimaryBillingCta(subscriptionAccess)

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-12 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-6">
        <Badge>Practice-first access</Badge>
        <h1 className="max-w-6xl font-serif text-5xl leading-[0.95] tracking-tight text-[var(--ink-strong)] sm:text-6xl">
          Practical coding sessions that help you improve faster than passive courses.
        </h1>
        <p className="max-w-4xl text-lg leading-8 text-[var(--ink)]">
          Practice with short readings, real coding exercises, and a steady session flow built to keep your reps useful
          and your progress clear.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="h-full overflow-hidden bg-[linear-gradient(160deg,rgba(201,111,54,0.96),rgba(219,145,80,0.92))] text-white">
          <CardHeader className="border-b border-white/12">
            <CardTitle className="font-serif text-4xl leading-[1.05] text-white">Practical Coding Access</CardTitle>
            <CardDescription className="text-white/80">
              A paid subscription focused on short practical sessions, steady reps, and real coding feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="rounded-[1.75rem] bg-white/12 p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">{plan.cadenceLabel}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{plan.priceLabel}</p>
              <p className="mt-3 text-sm leading-7 text-white/80">
                {plan.tagline}
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
            <div className="flex flex-wrap items-center gap-3">
              <Link href={primaryCta.href}>
                <Button className="bg-white text-[var(--ink-strong)] hover:bg-white/90">
                  {primaryCta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-white/75">{primaryCta.helperText}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,241,0.94))]">
          <CardHeader>
            <CardTitle>Why people subscribe</CardTitle>
            <CardDescription>
              The platform is built for learners who want hands-on progress, not a pile of unfinished video courses.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {reasonsToJoin.map((item) => {
              const Icon = item.icon

              return (
                <div key={item.title} className="rounded-[1.5rem] bg-white/80 p-5 ring-1 ring-black/6">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--accent)]" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--ink-strong)]">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink)]">{item.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="h-full overflow-hidden">
          <CardHeader>
            <CardTitle>What you get</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-[var(--ink)]">
            <p>Short practical sessions that remove guesswork from what to work on next.</p>
            <p>Hands-on exercises that force real practice instead of passive reading.</p>
            <p>A practice flow designed to stay clear even when your schedule is crowded.</p>
          </CardContent>
        </Card>

        <Card className="h-full overflow-hidden bg-[var(--ink-strong)] text-white">
          <CardHeader>
            <CardTitle className="text-white">Who this is for</CardTitle>
            <CardDescription className="text-white/75">
              For learners who want practical reps, immediate feedback, and a steady way to improve at coding.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-white/85">
            <p>If you want a focused practice rhythm instead of another theory-heavy course, this subscription is built to help you keep moving.</p>
            <Link href={primaryCta.href}>
              <Button>
                Start practicing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
