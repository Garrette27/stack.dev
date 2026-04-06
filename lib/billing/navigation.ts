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
      label: "Open your course catalog",
      helperText: "Your account is active. Continue into your next practical session."
    }
  }

  if (access.status === "inactive") {
    return {
      href: "/billing",
      label: "Start practicing",
      helperText: "Review the plan and get your practice subscription ready."
    }
  }

  return {
    href: "/login",
    label: "Start practicing",
    helperText: "Sign in first so your plan, progress, and billing all stay on one account."
  }
}
