import "server-only"

import { getCurrentUser } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export type SubscriptionAccessSnapshot = {
  signedIn: boolean
  status: "anonymous" | "inactive" | "active"
  planId: string | null
  currentPeriodEnd: string | null
  canAccessPaidContent: boolean
}

/**
 * Returns the current user's subscription access in one place so pricing and
 * gated content do not need to understand table-level subscription details.
 */
export async function getCurrentSubscriptionAccess(): Promise<SubscriptionAccessSnapshot> {
  const user = await getCurrentUser()

  if (!user || !hasSupabaseEnv()) {
    return {
      signedIn: Boolean(user),
      status: user ? "inactive" : "anonymous",
      planId: null,
      currentPeriodEnd: null,
      canAccessPaidContent: false
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      signedIn: true,
      status: "inactive",
      planId: null,
      currentPeriodEnd: null,
      canAccessPaidContent: false
    }
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle()

  const isActive = subscription?.status === "active" || subscription?.status === "trialing"

  return {
    signedIn: true,
    status: isActive ? "active" : "inactive",
    planId: subscription?.plan_id ? String(subscription.plan_id) : null,
    currentPeriodEnd: subscription?.current_period_end ? String(subscription.current_period_end) : null,
    canAccessPaidContent: Boolean(isActive)
  }
}
