"use client"

import { AuthoringCodeFenceField } from "@/components/admin/authoring-code-fence-field"
import { CodeAssignmentAuthoringFields } from "@/components/admin/code-assignment-authoring-fields"
import { LocalLabAuthoringFields } from "@/components/admin/local-lab-authoring-fields"
import { MultipleChoiceOptionsEditor } from "@/components/admin/multiple-choice-options-editor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { getChallengeKindOptionLabel } from "@/lib/challenges/presentation"
import type { ChallengeKind, CodeChallengeLanguage, MultipleChoiceOption } from "@/lib/types"

type SelectOption = {
  value: string
  label: string
}

type AssignmentSelectionModel = {
  value: string
  options: SelectOption[]
  publicationStateLabel: string
  onChange: (value: string) => void
}

type AssignmentReadingModel = {
  preview: string
  previewLabel: string
  hasChapterGuide: boolean
  assignmentReadingMdx: string
  promptMdx: string
  onAssignmentReadingChange: (value: string) => void
  onClearAssignmentReading: () => void
  onPromptMdxChange: (value: string) => void
}

type AssignmentKindModel = {
  value: ChallengeKind
  onChange: (value: ChallengeKind) => void
}

type CodeAssignmentModel = {
  language: CodeChallengeLanguage
  judge0LanguageId: string
  starterCode: string
  solutionCode: string
  hiddenTestCode: string
  onLanguageChange: (value: CodeChallengeLanguage) => void
  onJudge0LanguageIdChange: (value: string) => void
  onStarterCodeChange: (value: string) => void
  onSolutionCodeChange: (value: string) => void
  onHiddenTestCodeChange: (value: string) => void
}

type LocalLabAssignmentModel = {
  submitCommandTemplate: string
  solutionNotes: string
  manifestSource: string
  onSubmitCommandTemplateChange: (value: string) => void
  onSolutionNotesChange: (value: string) => void
  onManifestSourceChange: (value: string) => void
}

type MultipleChoiceAssignmentModel = {
  options: MultipleChoiceOption[]
  correctChoiceKey: string
  explanationMdx: string
  onOptionsChange: (options: MultipleChoiceOption[]) => void
  onCorrectChoiceKeyChange: (key: string) => void
  onExplanationChange: (value: string) => void
}

type AuthoringAssignmentSectionProps = {
  selection: AssignmentSelectionModel
  reading: AssignmentReadingModel
  kind: AssignmentKindModel
  codeAssignment: CodeAssignmentModel
  localLabAssignment: LocalLabAssignmentModel
  multipleChoiceAssignment: MultipleChoiceAssignmentModel
}

/**
 * Concentrates assignment-specific authoring flow behind one interface so the
 * parent form coordinates sections instead of knowing how every assignment kind
 * is rendered.
 */
export function AuthoringAssignmentSection({
  selection,
  reading,
  kind,
  codeAssignment,
  localLabAssignment,
  multipleChoiceAssignment
}: AuthoringAssignmentSectionProps) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,var(--showcase-surface),var(--surface))]">
      <CardHeader className="border-b border-[var(--border-soft)] bg-[var(--showcase-surface-soft)]">
        <CardTitle>Assignment</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Add a new assignment to this chapter, or load one of the existing assignments to revise it.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 p-6">
        <Field label="Assignment">
          <select
            value={selection.value}
            onChange={(event) => selection.onChange(event.target.value)}
            className="flex h-12 w-full rounded-2xl border border-[var(--field-border)] bg-[var(--field-surface)] px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
          >
            {selection.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <p className="rounded-[1.5rem] bg-[var(--surface-hover)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Existing assignments stay selected after you save, so you can keep refining the same work without accidentally creating duplicates.
        </p>

        <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink-strong)]">Learner reading preview</p>
              <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
                Switching assignments changes this preview immediately. If assignment reading is blank, the assignment
                prompt becomes the main learner reading.
              </p>
              {reading.hasChapterGuide ? (
                <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
                  The chapter guide is available separately on the learner page whenever you add one here.
                </p>
              ) : null}
            </div>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
              {reading.previewLabel}
            </span>
          </div>
          <Textarea
            rows={10}
            value={reading.preview}
            readOnly
            className="mt-4 cursor-default border-[var(--field-border)] bg-[var(--field-surface)] text-[var(--ink)]"
          />
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink-strong)]">Publishing workflow</p>
              <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
                Drafts stay visible in admin so you can keep iterating. Publishing promotes the selected draft to the
                live learner version for this assignment.
              </p>
            </div>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)] ring-1 ring-[var(--border-subtle)]">
              {selection.publicationStateLabel}
            </span>
          </div>
        </div>

        <Field label="Assignment type">
          <select
            value={kind.value}
            onChange={(event) => kind.onChange(event.target.value as ChallengeKind)}
            className="flex h-12 w-full rounded-2xl border border-[var(--field-border)] bg-[var(--field-surface)] px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
          >
            <option value="code">{getChallengeKindOptionLabel("code")}</option>
            <option value="multiple_choice">{getChallengeKindOptionLabel("multiple_choice")}</option>
            <option value="local_lab">{getChallengeKindOptionLabel("local_lab")}</option>
          </select>
        </Field>

        <AuthoringCodeFenceField
          label="Assignment reading (optional, only for the selected assignment)"
          name="readingMdx"
          rows={10}
          value={reading.assignmentReadingMdx}
          onChange={reading.onAssignmentReadingChange}
          onClear={reading.onClearAssignmentReading}
          placeholder={"Use this only when one assignment needs its own reading.\n\nLeave it blank to use the assignment prompt as the main learner reading."}
          emptyActionLabel="Use assignment prompt"
          helperText="Leave this blank when the assignment prompt already explains the work well enough. Fill it only when this question needs separate study text."
        />

        <Field label="Assignment prompt (MDX)">
          <Textarea
            name="promptMdx"
            rows={12}
            value={reading.promptMdx}
            onChange={(event) => reading.onPromptMdxChange(event.target.value)}
            placeholder={"Explain the task clearly.\n\n- What to print or return\n- What matters about the output\n- Any edge cases"}
            required
          />
        </Field>

        {kind.value === "code" ? (
          <CodeAssignmentAuthoringFields {...codeAssignment} />
        ) : kind.value === "local_lab" ? (
          <LocalLabAuthoringFields
            submitCommandTemplate={localLabAssignment.submitCommandTemplate}
            solutionNotes={localLabAssignment.solutionNotes}
            manifestSource={localLabAssignment.manifestSource}
            onSubmitCommandTemplateChange={localLabAssignment.onSubmitCommandTemplateChange}
            onSolutionNotesChange={localLabAssignment.onSolutionNotesChange}
            onManifestSourceChange={localLabAssignment.onManifestSourceChange}
          />
        ) : (
          <MultipleChoiceOptionsEditor
            options={multipleChoiceAssignment.options}
            correctChoiceKey={multipleChoiceAssignment.correctChoiceKey}
            explanationMdx={multipleChoiceAssignment.explanationMdx}
            onOptionsChange={multipleChoiceAssignment.onOptionsChange}
            onCorrectChoiceKeyChange={multipleChoiceAssignment.onCorrectChoiceKeyChange}
            onExplanationChange={multipleChoiceAssignment.onExplanationChange}
          />
        )}
      </CardContent>
    </Card>
  )
}
