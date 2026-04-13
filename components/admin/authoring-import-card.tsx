"use client"

import { useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { BULK_IMPORT_OUTLINE_EXAMPLE, buildBulkImportAiPrompt } from "@/lib/admin/catalog-import"

type AuthoringImportCardProps = {
  courseTitle: string
  lessonTitle: string
  assignmentLabel: string
  onApplyImport: (source: string) => { success: boolean; message: string }
}

/**
 * Gives the currently selected authoring target its own import surface so
 * authors can paste one formatted outline, load it into the editor, and then
 * save or publish without bouncing to the catalog-wide import panel.
 */
export function AuthoringImportCard({
  courseTitle,
  lessonTitle,
  assignmentLabel,
  onApplyImport
}: AuthoringImportCardProps) {
  const [source, setSource] = useState("")
  const [authorNotes, setAuthorNotes] = useState("")
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const publishSubmitRef = useRef<HTMLButtonElement | null>(null)
  const draftSubmitRef = useRef<HTMLButtonElement | null>(null)

  const aiPrompt = useMemo(
    () =>
      buildBulkImportAiPrompt({
        destinationScope: "existing_lesson",
        targetCourseTitle: courseTitle,
        targetLessonTitle: lessonTitle,
        authorNotes
      }),
    [authorNotes, courseTitle, lessonTitle]
  )

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt)
      setCopied(true)
      setFeedback({
        success: true,
        message: "AI formatting prompt copied. Paste it into ChatGPT, then paste the formatted outline back here."
      })
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setFeedback({
        success: false,
        message: "Clipboard copy was blocked in this browser. You can still copy the prompt from the box below."
      })
    }
  }

  function handleApplyImport() {
    const result = onApplyImport(source)
    setFeedback(result)
  }

  function handleApplyImportAndSubmit(saveMode: "draft" | "publish") {
    let result: { success: boolean; message: string } = {
      success: false,
      message: ""
    }

    flushSync(() => {
      result = onApplyImport(source)
      setFeedback(result)
    })

    if (!result.success) {
      return
    }

    const submitter = saveMode === "publish" ? publishSubmitRef.current : draftSubmitRef.current
    const form = submitter?.form

    if (!submitter || !form) {
      setFeedback({
        success: false,
        message: "The authoring form could not be submitted automatically. The import is loaded, so you can still save below."
      })
      return
    }

    window.requestAnimationFrame(() => {
      form.requestSubmit(submitter)
    })
  }

  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,var(--showcase-surface),var(--surface))]">
      <CardHeader className="border-b border-[var(--border-soft)] bg-[var(--showcase-surface-soft)]">
        <CardTitle>Assignment quick import</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Load one formatted outline into the assignment you are currently editing. The chapter BODY fills the chapter guide, and the first imported assignment fills {assignmentLabel}.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 p-6">
        <p className="rounded-[1.5rem] bg-[var(--surface-hover)] px-4 py-3 text-sm leading-7 text-[var(--ink-muted)]">
          Use this when another AI has already formatted your Boot.dev-style source. You can load it into the current editor, or load and immediately save/publish the assignment you are revising.
        </p>

        <Field label="AI notes (optional)">
          <Textarea
            rows={3}
            value={authorNotes}
            onChange={(event) => setAuthorNotes(event.target.value)}
            placeholder={"Add any extra guidance for the outside AI.\n\nExamples:\n- Correct answer: It is basically the only language that can run in a web browser.\n- Keep this as a multiple-choice question.\n- Generate hidden tests from the expected console output."}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleCopyPrompt}>
            {copied ? "Prompt copied" : "Copy AI prompt"}
          </Button>
        </div>

        <details className="rounded-[1.5rem] bg-[var(--showcase-surface-soft)] p-4 text-sm leading-7 text-[var(--ink-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--ink-strong)]">AI formatting prompt</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[1rem] bg-[var(--card-surface)] p-4 text-xs leading-6 text-[var(--ink)]">
            {aiPrompt}
          </pre>
        </details>

        <Field label="Formatted outline or JSON">
          <Textarea
            rows={16}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={BULK_IMPORT_OUTLINE_EXAMPLE}
            className="min-h-[18rem] font-mono text-xs leading-6"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleApplyImport} disabled={!source.trim()}>
            Load into editor
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleApplyImportAndSubmit("draft")} disabled={!source.trim()}>
            Load and save draft
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleApplyImportAndSubmit("publish")} disabled={!source.trim()}>
            Load and publish
          </Button>
          {feedback ? (
            <p className={feedback.success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{feedback.message}</p>
          ) : null}
        </div>

        <button ref={draftSubmitRef} type="submit" name="saveMode" value="draft" className="hidden" aria-hidden="true" tabIndex={-1} />
        <button ref={publishSubmitRef} type="submit" name="saveMode" value="publish" className="hidden" aria-hidden="true" tabIndex={-1} />
      </CardContent>
    </Card>
  )
}
