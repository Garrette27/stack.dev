"use client"

import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { getLocalLabDefinition } from "@/lib/local-labs"

type LocalLabAuthoringFieldsProps = {
  submitCommandTemplate: string
  solutionNotes: string
  manifestSource: string
  onSubmitCommandTemplateChange: (value: string) => void
  onSolutionNotesChange: (value: string) => void
  onManifestSourceChange: (value: string) => void
}

/**
 * Groups the local-lab authoring fields behind one interface so the main
 * authoring form stays focused on course, chapter, and assignment flow.
 */
export function LocalLabAuthoringFields({
  submitCommandTemplate,
  solutionNotes,
  manifestSource,
  onSubmitCommandTemplateChange,
  onSolutionNotesChange,
  onManifestSourceChange
}: LocalLabAuthoringFieldsProps) {
  const localLab = getLocalLabDefinition({
    submitCommandTemplate,
    solutionNotes,
    manifestSource
  })

  return (
    <div className="grid gap-5">
      <div className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-strong)]">Local lab flow</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
              Learners will run this assignment on their own machine through the CLI instead of using the in-browser checker.
            </p>
          </div>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
            {localLab.manifest ? `${localLab.manifest.checks.length} checks` : "manifest needed"}
          </span>
        </div>
      </div>

      <Field
        label="CLI submit command template"
        hint="Learners will copy this command into their terminal. Keep placeholders explicit so the future CLI session signer can replace them safely."
      >
        <Textarea
          name="starterCode"
          rows={4}
          value={submitCommandTemplate}
          onChange={(event) => onSubmitCommandTemplateChange(event.target.value)}
          placeholder="stack local-lab submit {{challenge_slug}}"
          required
        />
      </Field>

      <Field
        label="Local check manifest (JSON)"
        hint="This manifest describes what the CLI should run and what it should expect back from the learner's machine."
      >
        <Textarea
          name="hiddenTestCode"
          rows={18}
          value={manifestSource}
          onChange={(event) => onManifestSourceChange(event.target.value)}
          placeholder={`{\n  "version": 1,\n  "runner": "stack_cli",\n  "setupSteps": [],\n  "checks": []\n}`}
          required
        />
      </Field>

      {localLab.manifestError ? (
        <p className="text-sm text-rose-700">{localLab.manifestError}</p>
      ) : (
        <p className="text-sm text-emerald-700">
          Manifest looks valid and will run {localLab.manifest?.checks.length ?? 0} check{localLab.manifest?.checks.length === 1 ? "" : "s"}.
        </p>
      )}

      <Field
        label="Reference solution notes (author only)"
        hint="Keep implementation notes, expected file changes, or troubleshooting guidance here. This field is stored for authors and future CLI tooling."
      >
        <Textarea
          name="solutionCode"
          rows={8}
          value={solutionNotes}
          onChange={(event) => onSolutionNotesChange(event.target.value)}
          placeholder="Document the expected local setup, files, and successful outcome for future authoring and CLI tooling."
        />
      </Field>
    </div>
  )
}
