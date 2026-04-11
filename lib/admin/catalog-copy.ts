/**
 * Centralizes the catalog copy rules that multiple admin write paths depend on.
 * Keeping these derivations here prevents title and summary heuristics from
 * drifting between import, authoring, and future catalog tools.
 */
function firstMeaningfulCatalogLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find(Boolean)
}

export function deriveCatalogChallengeTitle(promptMdx: string) {
  const firstLine = firstMeaningfulCatalogLine(promptMdx)
  if (!firstLine) {
    return "Assignment"
  }

  return firstLine.length > 96 ? `${firstLine.slice(0, 93).trimEnd()}...` : firstLine
}

export function deriveCatalogLessonSummary(bodyMdx: string, lessonTitle: string, providedSummary?: string) {
  if (providedSummary?.trim()) {
    return providedSummary.trim()
  }

  const firstLine = firstMeaningfulCatalogLine(bodyMdx)
  if (!firstLine) {
    return `${lessonTitle} practice and assignments.`
  }

  return firstLine.length > 120 ? `${firstLine.slice(0, 117).trimEnd()}...` : firstLine
}
