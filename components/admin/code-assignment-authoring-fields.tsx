"use client"

import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AUTHORING_LANGUAGE_OPTIONS } from "@/lib/judge0/languages"
import type { CodeChallengeLanguage } from "@/lib/types"

type CodeAssignmentAuthoringFieldsProps = {
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

/**
 * Groups the code-only authoring fields behind one interface so the broader
 * assignment section can stay focused on assignment workflow instead of runner
 * details.
 */
export function CodeAssignmentAuthoringFields({
  language,
  judge0LanguageId,
  starterCode,
  solutionCode,
  hiddenTestCode,
  onLanguageChange,
  onJudge0LanguageIdChange,
  onStarterCodeChange,
  onSolutionCodeChange,
  onHiddenTestCodeChange
}: CodeAssignmentAuthoringFieldsProps) {
  return (
    <>
      <section className="grid gap-5 lg:grid-cols-2">
        <Field label="Answer language">
          <select
            name="language"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as CodeChallengeLanguage)}
            className="flex h-12 w-full rounded-2xl border border-[var(--field-border)] bg-[var(--field-surface)] px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
          >
            {AUTHORING_LANGUAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Checker language id">
          <Input
            name="judge0LanguageId"
            type="number"
            value={judge0LanguageId}
            onChange={(event) => onJudge0LanguageIdChange(event.target.value)}
            required
          />
        </Field>
      </section>

      <Field label="Starter code">
        <Textarea
          name="starterCode"
          rows={14}
          value={starterCode}
          onChange={(event) => onStarterCodeChange(event.target.value)}
          required
        />
      </Field>

      <Field label="Reference solution">
        <Textarea
          name="solutionCode"
          rows={14}
          value={solutionCode}
          onChange={(event) => onSolutionCodeChange(event.target.value)}
          required
        />
      </Field>

      <Field label="Hidden checker tests">
        <Textarea
          name="hiddenTestCode"
          rows={12}
          value={hiddenTestCode}
          onChange={(event) => onHiddenTestCodeChange(event.target.value)}
          required
        />
      </Field>
    </>
  )
}
