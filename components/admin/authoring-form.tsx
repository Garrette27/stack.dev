"use client"

import { AuthoringAssignmentSection } from "@/components/admin/authoring-assignment-section"
import { AuthoringChapterSection } from "@/components/admin/authoring-chapter-section"
import { AuthoringCourseSection } from "@/components/admin/authoring-course-section"
import { AuthoringImportCard } from "@/components/admin/authoring-import-card"
import { useAuthoringFormController } from "@/components/admin/use-authoring-form-controller"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ContentSnapshot } from "@/lib/types"
import type { PersistedAuthoringSelection } from "@/lib/admin/authoring-session"

type AuthoringFormProps = {
  snapshot: ContentSnapshot
  initialSelection?: PersistedAuthoringSelection | null
}

/**
 * Keeps the top-level admin authoring form focused on composing the course,
 * chapter, and assignment sections while a controller hook owns draft and
 * selection behavior.
 */
export function AuthoringForm({ snapshot, initialSelection = null }: AuthoringFormProps) {
  const controller = useAuthoringFormController({
    snapshot,
    initialSelection
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border-soft)] bg-[var(--showcase-surface-soft)]">
        <CardTitle>Create chapter + assignment</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Choose a course, choose a chapter, then attach one assignment to that chapter.
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 p-6">
        <form action={controller.formAction} className="grid gap-8">
          {controller.hiddenFields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} readOnly />
          ))}

          <AuthoringCourseSection {...controller.courseSection} />
          <AuthoringChapterSection {...controller.chapterSection} />
          <AuthoringAssignmentSection {...controller.assignmentSection} />
          <AuthoringImportCard {...controller.authoringImport} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" name="saveMode" value="publish" disabled={controller.pending}>
              {controller.pending ? "Saving..." : "Publish chapter and assignment"}
            </Button>
            <Button type="submit" name="saveMode" value="draft" variant="secondary" disabled={controller.pending}>
              {controller.pending ? "Saving..." : "Save draft"}
            </Button>
            {controller.submitFeedback ? (
              <p className={controller.submitFeedback.success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
                {controller.submitFeedback.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
