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
    name: "Career Shifter Access",
    tagline: "A focused plan for learners building software skills around a busy life.",
    priceLabel: "Paid plan at launch",
    cadenceLabel: "Monthly subscription",
    featured: true,
    highlights: [
      "Short daily lessons built for working adults",
      "Hands-on coding practice with immediate feedback",
      "Resume exactly where you left off",
      "Structured path for career shifters moving into software"
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
