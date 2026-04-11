import "server-only"

import { hasSupabaseAdminEnv } from "@/lib/env"
import { mockContent } from "@/lib/mock-data"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Challenge, ContentSnapshot } from "@/lib/types"

import { mapChallengesFromRows } from "@/lib/content/challenge-versions"
import {
  loadOptionalCatalogVersionRows,
  loadOptionalChallengeVersionRows,
  loadOptionalLessonChallengeRows,
  loadSnapshotFromRows
} from "@/lib/content/snapshot-loader"
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

  const challengeRow = data as Record<string, unknown>
  const currentPublishedVersionId = challengeRow.current_published_version_id ? String(challengeRow.current_published_version_id) : null

  if (!currentPublishedVersionId) {
    return mapChallenge(challengeRow)
  }

  const { data: versionRow, error: versionError } = await admin!
    .from("challenge_versions")
    .select("*")
    .eq("id", currentPublishedVersionId)
    .maybeSingle()

  if (versionError?.code === "42P01" || versionError?.code === "PGRST205" || !versionRow) {
    return mapChallenge(challengeRow)
  }

  return mapChallengesFromRows([challengeRow], [versionRow as Record<string, unknown>], "published")[0] ?? null
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
      const [
        { data: courseRows },
        { data: lessonRows },
        { data: challengeRows },
        courseVersionRows,
        lessonVersionRows,
        challengeVersionRows,
        lessonChallengeRows
      ] = await Promise.all([
        admin!.from("courses").select("*").order("title"),
        admin!.from("lessons").select("*").order("order_index"),
        admin!.from("challenges").select("*").order("title"),
        loadOptionalCatalogVersionRows(async () => {
          const result = await admin!
            .from("course_versions")
            .select("*")
            .order("course_id")
            .order("version_number", { ascending: false })

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        }),
        loadOptionalCatalogVersionRows(async () => {
          const result = await admin!
            .from("lesson_versions")
            .select("*")
            .order("lesson_id")
            .order("version_number", { ascending: false })

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        }),
        loadOptionalChallengeVersionRows(async () => {
          const result = await admin!
            .from("challenge_versions")
            .select("*")
            .order("challenge_id")
            .order("version_number", { ascending: false })

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        }),
        loadOptionalLessonChallengeRows(async () => {
          const result = await admin!
            .from("lesson_challenges")
            .select("lesson_id,challenge_id,order_index")
            .order("lesson_id")
            .order("order_index")

          return {
            data: (result.data ?? null) as Record<string, unknown>[] | null,
            error: result.error ? { code: result.error.code, message: result.error.message } : null
          }
        })
      ])

      return {
        rows: {
          courseRows: (courseRows ?? []) as Record<string, unknown>[],
          courseVersionRows,
          lessonRows: (lessonRows ?? []) as Record<string, unknown>[],
          lessonVersionRows,
          challengeRows: (challengeRows ?? []) as Record<string, unknown>[],
          challengeVersionRows,
          lessonChallengeRows
        }
      }
    },
    challengeVersionMode: "draft_or_published",
    catalogVersionMode: "draft_or_published"
  })
}
