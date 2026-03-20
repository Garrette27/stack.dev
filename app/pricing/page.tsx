import Link from "next/link"
import { ArrowRight, Banknote, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const plans = [
  {
    name: "Solo Builder",
    price: "Free while you build",
    description: "Perfect for private daily practice while you shape the curriculum and authoring workflow.",
    features: ["Full learner flow", "Private admin panel", "Progress sync", "Judge0-ready checks"]
  },
  {
    name: "Focused Pro",
    price: "Future paid plan",
    description: "A clean upgrade path for 100-500 paying learners once the curriculum and payment rails are stable.",
    features: ["Course access control", "Billing webhooks", "Plan-based entitlements", "Local PH payment methods"]
  }
]

export default function PricingPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-10 px-4 py-12 sm:px-6 xl:px-10">
      <section className="grid gap-5">
        <Badge>Keep billing behind the core loop</Badge>
        <h1 className="font-serif text-5xl tracking-tight text-[var(--ink-strong)]">Charge only after the study loop feels obvious.</h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--ink)]">
          The payment system should unlock access and sync subscription state. It should not leak complexity into lesson
          reading, code checking, or progress tracking.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.name}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[1.5rem] bg-[color:rgb(201_111_54/0.08)] p-4">
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--ink-muted)]">Price</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ink-strong)]">{plan.price}</p>
              </div>
              <div className="grid gap-3 text-sm text-[var(--ink)]">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-[var(--ink-strong)] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Banknote className="h-5 w-5 text-[var(--accent-soft)]" />
              Billing architecture
            </CardTitle>
            <CardDescription className="text-white/75">
              Keep pricing and entitlements deep in the billing module, not scattered through pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-white/80">
            <p>Use webhook-synced subscriptions and a single access check for paid content.</p>
            <p>For the Philippines, prefer a provider that supports local methods like GCash or Maya when you go paid.</p>
            <p>Until then, keep the app fully usable for yourself and keep billing dormant.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next when you are ready to sell</CardTitle>
            <CardDescription>Do not connect billing before the admin and checker workflows feel reliable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin">
              <Button>
                Finish content operations first
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
