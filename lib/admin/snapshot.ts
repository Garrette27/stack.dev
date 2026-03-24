import "server-only"

import { hasSupabaseAdminEnv } from "@/lib/env"
import { mockContent } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Challenge, ContentSnapshot } from "@/lib/types"

import { loadSnapshotFromRows } from "@/lib/content/snapshot-loader"
import { mapChallenge } from "@/lib/content/shared"

/**
 * Returns a challenge payload that can be executed by the submission runner.
 */
export async function getRunnerChallengeBySlug(challengeSlug: string): Promise<Challenge | null> {
  if (!hasSupabaseAdminEnv()) {
    return mockContent.challenges.find((item) => item.slug === challengeSlug) ?? null
  }

  const admin = createAdminClient()
  const { data } = await admin!.from("challenges").select("*").eq("slug", challengeSlug).maybeSingle()

  if (!data) {
    return null
  }

  return mapChallenge(data as Record<string, unknown>)
}

/**
 * Returns all authored content visible to the admin surface.
 */
export async function getAdminSnapshot(): Promise<ContentSnapshot> {
  return loadSnapshotFromRows({
    emptyMode: "database",
    emptyContentReason: "No courses or lessons have been created yet.",
    contentSourceReason: "Live project content",
    loadRows: async () => {
      if (!hasSupabaseAdminEnv()) {
        return {
          rows: {},
          fallbackReason: "Authoring preview is showing because admin access is not configured for this project."
        }
      }

      const admin = createAdminClient()
      const [{ data: courseRows }, { data: lessonRows }, { data: challengeRows }] = await Promise.all([
        admin!.from("courses").select("*").order("title"),
        admin!.from("lessons").select("*").order("order_index"),
        admin!.from("challenges").select("*").order("title")
      ])

      return {
        rows: {
          courseRows: (courseRows ?? []) as Record<string, unknown>[],
          lessonRows: (lessonRows ?? []) as Record<string, unknown>[],
          challengeRows: (challengeRows ?? []) as Record<string, unknown>[]
        }
      }
    }
  })
}
