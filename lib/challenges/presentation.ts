import type { Challenge, ChallengeKind } from "@/lib/types"

/**
 * Keeps challenge-type display wording in one place so new delivery modes do
 * not leak string conditionals through learner pages.
 */
export function getChallengeTypeLabel(challenge: Pick<Challenge, "kind" | "language">) {
  switch (challenge.kind) {
    case "multiple_choice":
      return "multiple choice"
    case "local_lab":
      return "local lab"
    default:
      return challenge.language ?? "code"
  }
}

/**
 * Gives admin surfaces a stable label for each assignment type selector entry.
 */
export function getChallengeKindOptionLabel(kind: ChallengeKind) {
  switch (kind) {
    case "multiple_choice":
      return "Multiple choice"
    case "local_lab":
      return "Local lab"
    default:
      return "Code assignment"
  }
}
