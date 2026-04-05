"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createNextMultipleChoiceOption } from "@/lib/challenges/multiple-choice"
import type { MultipleChoiceOption } from "@/lib/types"

type MultipleChoiceOptionsEditorProps = {
  options: MultipleChoiceOption[]
  correctChoiceKey: string
  explanationMdx: string
  onOptionsChange: (options: MultipleChoiceOption[]) => void
  onCorrectChoiceKeyChange: (key: string) => void
  onExplanationChange: (value: string) => void
}

function getChoiceLetter(index: number) {
  return String.fromCharCode(65 + index)
}

/**
 * Edits multiple-choice answer rows without exposing storage details such as
 * JSON payloads or key allocation to the parent authoring form.
 */
export function MultipleChoiceOptionsEditor({
  options,
  correctChoiceKey,
  explanationMdx,
  onOptionsChange,
  onCorrectChoiceKeyChange,
  onExplanationChange
}: MultipleChoiceOptionsEditorProps) {
  const removeOption = (key: string) => {
    const remaining = options.filter((option) => option.key !== key)
    onOptionsChange(remaining)

    if (correctChoiceKey === key && remaining[0]) {
      onCorrectChoiceKeyChange(remaining[0].key)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-strong)]">Answer choices</p>
            <p className="text-sm leading-7 text-[var(--ink-muted)]">The learner can click one option and immediately see whether it is correct.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOptionsChange([...options, createNextMultipleChoiceOption(options)])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add choice
          </Button>
        </div>

        <div className="grid gap-3">
          {options.map((option, index) => {
            const isCorrect = option.key === correctChoiceKey

            return (
              <div
                key={option.key}
                className="grid gap-3 rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--showcase-surface-soft)] p-4 lg:grid-cols-[auto_1fr_auto_auto]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-hover)] text-sm font-semibold text-[var(--ink-strong)]">
                  {getChoiceLetter(index)}
                </div>
                <Input
                  value={option.label}
                  onChange={(event) =>
                    onOptionsChange(
                      options.map((current) =>
                        current.key === option.key
                          ? {
                              ...current,
                              label: event.target.value
                            }
                          : current
                      )
                    )
                  }
                  placeholder="Write the choice text the learner will click."
                />
                <Button
                  type="button"
                  variant={isCorrect ? "accent" : "secondary"}
                  size="sm"
                  onClick={() => onCorrectChoiceKeyChange(option.key)}
                >
                  {isCorrect ? "Correct answer" : "Mark correct"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(option.key)}
                  disabled={options.length <= 2}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <Field label="Answer explanation (optional)">
        <Textarea
          rows={5}
          value={explanationMdx}
          onChange={(event) => onExplanationChange(event.target.value)}
          placeholder={"Explain why the correct answer is right.\n\nThis appears after the learner answers."}
        />
      </Field>
    </div>
  )
}
