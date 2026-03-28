import type { SubscriptionAccessSnapshot } from "./access"

export type BillingPrimaryCta = {
  href: string
  label: string
  helperText: string
}

/**
 * Keeps pricing and dashboard CTA routing consistent without exposing billing
 * state decisions to multiple pages.
 */
export function getPrimaryBillingCta(access: SubscriptionAccessSnapshot): BillingPrimaryCta {
  if (access.status === "active") {
    return {
      href: "/learn",
      label: "Open your learning path",
      helperText: "Your account is active. Continue into the learning path."
    }
  }

  if (access.status === "inactive") {
    return {
      href: "/billing",
      label: "Start your transition",
      helperText: "Review the plan and get your subscription setup ready."
    }
  }

  return {
    href: "/login",
    label: "Start your transition",
    helperText: "Sign in first so your plan, progress, and billing all stay on one account."
  }
}
