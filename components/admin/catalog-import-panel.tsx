"use client"

import { useActionState } from "react"

import { importCatalogManifestAction, type AdminImportActionState } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BULK_IMPORT_OUTLINE_EXAMPLE } from "@/lib/admin/catalog-import"
import { Textarea } from "@/components/ui/textarea"

const initialImportState: AdminImportActionState = {
  success: false,
  message: ""
}

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
export function CatalogImportPanel() {
  const [state, formAction, pending] = useActionState(importCatalogManifestAction, initialImportState)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk import</CardTitle>
        <CardDescription>
          Paste either a JSON manifest or a structured bulk-authoring outline to create courses, chapters, and assignments in one pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form action={formAction} className="grid gap-4">
          <Textarea
            name="manifestSource"
            rows={18}
            required
            placeholder={BULK_IMPORT_OUTLINE_EXAMPLE}
            className="min-h-[24rem] font-mono text-xs leading-6"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" name="saveMode" value="draft" disabled={pending}>
              {pending ? "Importing..." : "Import as drafts"}
            </Button>
            <Button type="submit" name="saveMode" value="publish" variant="secondary" disabled={pending}>
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
          <p>Structured outline mode supports fenced MDX code blocks directly, so you do not need to use the insert-code buttons for bulk imports.</p>
        </div>

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
