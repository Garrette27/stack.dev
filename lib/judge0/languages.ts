import type { Challenge } from "@/lib/types"

/**
 * Defaults for this project's current Judge0 host. Keep UI defaults and
 * authored content aligned with the runner's expected language ids.
 */
export const DEFAULT_JUDGE0_LANGUAGE_IDS: Record<Challenge["language"], number> = {
  python: 71,
  javascript: 102
}

export function getDefaultJudge0LanguageId(language: Challenge["language"]) {
  return DEFAULT_JUDGE0_LANGUAGE_IDS[language]
}
