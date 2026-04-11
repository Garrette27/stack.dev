import { restoreVersionAction } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CatalogHistorySnapshot, CatalogHistorySection } from "@/lib/admin/catalog-history"

type CatalogHistoryPanelProps = {
  history: CatalogHistorySnapshot
  selection: {
    courseSlug?: string | null
    lessonSlug?: string | null
    challengeSlug?: string | null
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No timestamp yet"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date)
}

function getSectionLabel(section: CatalogHistorySection) {
  if (section.contentType === "course") {
    return "Course"
  }

  if (section.contentType === "lesson") {
    return "Chapter"
  }

  return "Assignment"
}

function getEventLabel(eventType: string) {
  return eventType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function getVersionBadges(section: CatalogHistorySection, versionId: string) {
  const badges: string[] = []

  if (section.publishedVersionId === versionId) {
    badges.push("Learner version")
  }

  if (section.draftVersionId === versionId) {
    badges.push("Current draft")
  }

  return badges
}

/**
 * Shows recent versions and audit events for the selected course, chapter, and
 * assignment so restore targets stay visible right next to authoring.
 */
export function CatalogHistoryPanel({ history, selection }: CatalogHistoryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalog history</CardTitle>
        <CardDescription>
          See what changed, who changed it, and restore an older version as a safe new draft without rewriting catalog history.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {history.sections.length ? (
          history.sections.map((section) => (
            <div
              key={`${section.contentType}:${section.slug}`}
              className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--showcase-surface-soft)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                      {getSectionLabel(section)}
                    </Badge>
                    <Badge className="bg-[var(--surface-hover)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                      {section.visible ? "Visible to learners" : "Hidden from learners"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-strong)]">{section.title}</p>
                    <p className="text-sm text-[var(--ink-muted)]">{section.slug}</p>
                  </div>
                </div>
                <div className="rounded-[1rem] bg-[var(--surface-hover)] px-3 py-2 text-xs leading-6 text-[var(--ink-muted)]">
                  <p>Published version: {section.publishedVersionId ? "Available" : "Not published yet"}</p>
                  <p>Draft version: {section.draftVersionId ? "Available" : "No draft yet"}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Recent versions</p>
                    <p className="text-sm leading-7 text-[var(--ink-muted)]">
                      Restoring a version creates a new draft, so older versions stay intact as safe recovery points.
                    </p>
                  </div>

                  {section.versions.length ? (
                    <div className="grid gap-3">
                      {section.versions.map((version) => {
                        const versionBadges = getVersionBadges(section, version.id)

                        return (
                          <div
                            key={version.id}
                            className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-[var(--ink-strong)]">Version {version.versionNumber}</p>
                                  <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                                    {getEventLabel(version.status)}
                                  </Badge>
                                  {versionBadges.map((badge) => (
                                    <Badge
                                      key={badge}
                                      className="bg-[var(--surface-hover)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]"
                                    >
                                      {badge}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="text-xs leading-6 text-[var(--ink-muted)]">
                                  <p>Created: {formatTimestamp(version.createdAt)}</p>
                                  <p>Updated: {formatTimestamp(version.updatedAt)}</p>
                                  {version.publishedAt ? <p>Published: {formatTimestamp(version.publishedAt)}</p> : null}
                                </div>
                              </div>

                              <form action={restoreVersionAction}>
                                <input type="hidden" name="contentType" value={section.contentType} />
                                <input type="hidden" name="courseSlug" value={selection.courseSlug ?? ""} />
                                <input type="hidden" name="lessonSlug" value={selection.lessonSlug ?? ""} />
                                <input type="hidden" name="challengeSlug" value={selection.challengeSlug ?? ""} />
                                <input type="hidden" name="versionId" value={version.id} />
                                <Button type="submit" variant="secondary" size="sm" disabled={section.draftVersionId === version.id}>
                                  {section.draftVersionId === version.id ? "Current draft" : "Restore as draft"}
                                </Button>
                              </form>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-[1.25rem] bg-[var(--card-surface)] px-4 py-3 text-sm leading-7 text-[var(--ink-muted)]">
                      No version history yet. The next draft save or publish will create the first restore point.
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Recent activity</p>
                    <p className="text-sm leading-7 text-[var(--ink-muted)]">Each event records what changed and which account triggered it.</p>
                  </div>

                  {section.events.length ? (
                    <div className="grid gap-3">
                      {section.events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-[var(--surface-strong)] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
                              {getEventLabel(event.eventType)}
                            </Badge>
                            <p className="text-xs text-[var(--ink-muted)]">{formatTimestamp(event.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-sm text-[var(--ink-strong)]">{event.changeSummary}</p>
                          <div className="mt-2 text-xs leading-6 text-[var(--ink-muted)]">
                            <p>Actor: {event.actorEmail ?? "Unknown author"}</p>
                            {event.fromVersionId ? <p>From version: {event.fromVersionId}</p> : null}
                            {event.toVersionId ? <p>To version: {event.toVersionId}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-[1.25rem] bg-[var(--card-surface)] px-4 py-3 text-sm leading-7 text-[var(--ink-muted)]">
                      No activity has been recorded for this selection yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] px-4 py-3 text-sm leading-7 text-[var(--ink-muted)]">
            Pick a course, chapter, or assignment in admin to see its version history and restore targets here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
