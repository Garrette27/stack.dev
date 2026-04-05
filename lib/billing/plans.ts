export type BillingPlan = {
  slug: string
  name: string
  tagline: string
  priceLabel: string
  cadenceLabel: string
  highlights: string[]
  featured?: boolean
}

const PUBLIC_PLANS: BillingPlan[] = [
  {
    slug: "career-shifter-monthly",
    name: "Practical Coding Access",
    tagline: "A focused plan for learners building coding skill through short practical sessions.",
    priceLabel: "Paid plan at launch",
    cadenceLabel: "Monthly subscription",
    featured: true,
    highlights: [
      "Short practical sessions built for busy schedules",
      "Hands-on coding practice with immediate feedback",
      "Resume exactly where you left off",
      "A practice-first flow that stays useful even when time is limited"
    ]
  }
]

/**
 * Returns the public plan catalog used by pricing and future access checks.
 */
export function getPublicPlans() {
  return PUBLIC_PLANS
}

/**
 * Returns the primary plan the product should sell first.
 */
export function getPrimaryPlan() {
  return PUBLIC_PLANS[0]
}
