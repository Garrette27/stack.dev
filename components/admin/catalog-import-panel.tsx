"use client"

import { useActionState, useEffect, useMemo, useState } from "react"

import { importCatalogManifestAction, type AdminImportActionState } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { BULK_IMPORT_OUTLINE_EXAMPLE, buildBulkImportAiPrompt } from "@/lib/admin/catalog-import"

const initialImportState: AdminImportActionState = {
  success: false,
  message: ""
}

type CatalogImportTarget = {
  slug: string
  title: string
  lessons: Array<{
    slug: string
    title: string
  }>
}

type DestinationScope = "new_course" | "existing_course" | "existing_lesson"

const manifestExample = `{
  "course": {
    "title": "Learn Docker",
    "summary": "Container basics, images, networks, and practical local labs.",
    "difficulty": "Beginner",
    "accent": "#2f7edb",
    "lessons": [
      {
        "title": "Install Docker",
        "summary": "Set up Docker locally and verify the CLI.",
        "estimatedMinutes": 12,
        "bodyMdx": "# Install Docker\\n\\nFollow the setup guide for your operating system.",
        "challenges": [
          {
            "kind": "local_lab",
            "title": "Verify the Docker CLI",
            "promptMdx": "Run the Docker CLI locally and confirm it is installed.",
            "starterCode": "stackdev lab submit <id>",
            "solutionCode": "Install Docker Desktop or Docker Engine, then run the submit command.",
            "hiddenTestCode": "{\\n  \\"checks\\": []\\n}"
          }
        ]
      }
    ]
  }
}`

/**
 * Lets authors import large chunks of catalog content as drafts or published
 * rows without hand-creating every chapter and assignment in the form.
 */
export function CatalogImportPanel({
  targets,
  defaultCourseSlug,
  defaultLessonSlug
}: {
  targets: CatalogImportTarget[]
  defaultCourseSlug?: string | null
  defaultLessonSlug?: string | null
}) {
  const [state, formAction, pending] = useActionState(importCatalogManifestAction, initialImportState)
  const initialDestinationScope: DestinationScope = defaultLessonSlug
    ? "existing_lesson"
    : defaultCourseSlug
      ? "existing_course"
      : "new_course"
  const [destinationScope, setDestinationScope] = useState<DestinationScope>(initialDestinationScope)
  const [targetCourseSlug, setTargetCourseSlug] = useState(defaultCourseSlug ?? targets[0]?.slug ?? "")
  const lessonOptions = useMemo(
    () => targets.find((course) => course.slug === targetCourseSlug)?.lessons ?? [],
    [targetCourseSlug, targets]
  )
  const [targetLessonSlug, setTargetLessonSlug] = useState(defaultLessonSlug ?? lessonOptions[0]?.slug ?? "")
  const selectedCourse = useMemo(
    () => targets.find((course) => course.slug === targetCourseSlug) ?? null,
    [targetCourseSlug, targets]
  )
  const selectedLesson = useMemo(
    () => lessonOptions.find((lesson) => lesson.slug === targetLessonSlug) ?? null,
    [lessonOptions, targetLessonSlug]
  )
  const aiPrompt = useMemo(
    () =>
      buildBulkImportAiPrompt({
        destinationScope,
        targetCourseTitle: selectedCourse?.title ?? null,
        targetLessonTitle: selectedLesson?.title ?? null
      }),
    [destinationScope, selectedCourse?.title, selectedLesson?.title]
  )
  const importDisabled =
    pending ||
    (destinationScope !== "new_course" && !targetCourseSlug) ||
    (destinationScope === "existing_lesson" && !targetLessonSlug)

  useEffect(() => {
    setDestinationScope(initialDestinationScope)
    setTargetCourseSlug(defaultCourseSlug ?? targets[0]?.slug ?? "")
  }, [defaultCourseSlug, initialDestinationScope, targets])

  useEffect(() => {
    if (!lessonOptions.length) {
      setTargetLessonSlug("")
      return
    }

    const preferredLessonSlug =
      defaultCourseSlug === targetCourseSlug && defaultLessonSlug && lessonOptions.some((lesson) => lesson.slug === defaultLessonSlug)
        ? defaultLessonSlug
        : lessonOptions[0]?.slug ?? ""

    if (!lessonOptions.some((lesson) => lesson.slug === targetLessonSlug)) {
      setTargetLessonSlug(preferredLessonSlug)
    }
  }, [defaultCourseSlug, defaultLessonSlug, lessonOptions, targetCourseSlug, targetLessonSlug])

  function getDestinationSummary() {
    if (destinationScope === "existing_lesson" && selectedCourse && selectedLesson) {
      return `Assignments will be appended into ${selectedCourse.title} / ${selectedLesson.title}. This is the safest mode for adding "assignment 8" style content into an existing chapter.`
    }

    if (destinationScope === "existing_course" && selectedCourse) {
      return `New chapters will be appended into ${selectedCourse.title}.`
    }

    return "A brand-new course, chapter, and assignment structure will be created from the pasted outline."
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk import</CardTitle>
        <CardDescription>
          Paste either a JSON manifest or a structured bulk-authoring outline to create new course content or append new chapters and assignments into your existing catalog.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-3 rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--ink-strong)]">Import destination</p>
            <p className="text-sm leading-7 text-[var(--ink-muted)]">
              Choose whether this paste should create a new course, append new chapters to an existing course, or append new assignments to an existing chapter.
            </p>

            <label className="grid gap-2 text-sm text-[var(--ink)]">
              <span className="font-medium text-[var(--ink-strong)]">Destination mode</span>
              <select
                name="destinationScope"
                value={destinationScope}
                onChange={(event) =>
                  setDestinationScope(event.target.value as DestinationScope)
                }
                className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-[var(--ink-strong)]"
              >
                <option value="existing_lesson">Append assignments to existing chapter</option>
                <option value="existing_course">Append chapters to existing course</option>
                <option value="new_course">Create new course content</option>
              </select>
            </label>

            <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] px-4 py-3 text-sm leading-7 text-[var(--ink-muted)]">
              <p className="font-semibold text-[var(--ink-strong)]">Current import target</p>
              <p>{getDestinationSummary()}</p>
            </div>

            {destinationScope !== "new_course" ? (
              <label className="grid gap-2 text-sm text-[var(--ink)]">
                <span className="font-medium text-[var(--ink-strong)]">Target course</span>
                <select
                  name="targetCourseSlug"
                  value={targetCourseSlug}
                  onChange={(event) => setTargetCourseSlug(event.target.value)}
                  className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-[var(--ink-strong)]"
                >
                  {targets.map((course) => (
                    <option key={course.slug} value={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="targetCourseSlug" value="" />
            )}

            {destinationScope === "existing_lesson" ? (
              <label className="grid gap-2 text-sm text-[var(--ink)]">
                <span className="font-medium text-[var(--ink-strong)]">Target chapter</span>
                <select
                  name="targetLessonSlug"
                  value={targetLessonSlug}
                  onChange={(event) => setTargetLessonSlug(event.target.value)}
                  disabled={!lessonOptions.length}
                  className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--card-surface)] px-3 py-2 text-[var(--ink-strong)]"
                >
                  {lessonOptions.map((lesson) => (
                    <option key={lesson.slug} value={lesson.slug}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
                {!lessonOptions.length ? (
                  <span className="text-xs leading-6 text-[var(--ink-muted)]">This course does not have any chapters yet.</span>
                ) : null}
              </label>
            ) : (
              <input type="hidden" name="targetLessonSlug" value="" />
            )}
          </div>

          <Textarea
            name="manifestSource"
            rows={18}
            required
            placeholder={BULK_IMPORT_OUTLINE_EXAMPLE}
            className="min-h-[24rem] font-mono text-xs leading-6"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" name="saveMode" value="draft" disabled={importDisabled}>
              {pending ? "Importing..." : "Import as drafts"}
            </Button>
            <Button type="submit" name="saveMode" value="publish" variant="secondary" disabled={importDisabled}>
              {pending ? "Importing..." : "Import and publish"}
            </Button>
          </div>

          {state.message ? (
            <p className={state.success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>
          ) : null}
        </form>

        <div className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 text-sm leading-7 text-[var(--ink-muted)]">
          <p className="font-semibold text-[var(--ink-strong)]">Import notes</p>
          <p>The importer creates stable catalog rows and append-only versions, so the new content is restorable from the first import onward.</p>
          <p>Use draft mode when you are loading a large course and want to review it before learners see it.</p>
          <p>Structured outline mode supports fenced MDX code blocks directly, and the importer now repairs common rich-copy problems like plain-text code blocks, stray line numbers, and collapsed spacing.</p>
          <p>If you want another AI to convert messy pasted source into this format first, use the AI formatting prompt below. It is tuned for your workflow of pasting lesson reading, assignment text, starter code, solution, and then asking the outside AI to generate hidden tests or multiple-choice answers when needed.</p>
          <p>If you choose an existing chapter as the destination, imported chapter BODY text is folded into each imported assignment reading so Boot.dev-style lesson material maps into your current course structure more naturally.</p>
        </div>

        <details className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 text-sm leading-7 text-[var(--ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--ink-strong)]">AI formatting prompt</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[1rem] bg-[var(--card-surface)] p-4 text-xs leading-6 text-[var(--ink)]">
            {aiPrompt}
          </pre>
        </details>

        <details className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 text-sm leading-7 text-[var(--ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--ink-strong)]">JSON example</summary>
          <pre className="mt-3 overflow-x-auto rounded-[1rem] bg-[var(--card-surface)] p-4 text-xs leading-6 text-[var(--ink)]">
            {manifestExample}
          </pre>
        </details>

        <details className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 text-sm leading-7 text-[var(--ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--ink-strong)]">Structured outline example</summary>
          <pre className="mt-3 overflow-x-auto rounded-[1rem] bg-[var(--card-surface)] p-4 text-xs leading-6 text-[var(--ink)]">
            {BULK_IMPORT_OUTLINE_EXAMPLE}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}
