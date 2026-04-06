"use client"

import { AuthoringCodeFenceField } from "@/components/admin/authoring-code-fence-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type SelectOption = {
  value: string
  label: string
}

type AuthoringChapterSectionProps = {
  options: SelectOption[]
  selection: string
  lessonTitle: string
  resolvedCourseSlug: string
  resolvedLessonSlug: string
  bodyMdx: string
  onSelectionChange: (value: string) => void
  onLessonTitleChange: (value: string) => void
  onBodyMdxChange: (value: string) => void
  onClearBodyMdx: () => void
}

/**
 * Encapsulates chapter selection and guide authoring so callers only pass the
 * current chapter state and never need to manage the guide field UI directly.
 */
export function AuthoringChapterSection({
  options,
  selection,
  lessonTitle,
  resolvedCourseSlug,
  resolvedLessonSlug,
  bodyMdx,
  onSelectionChange,
  onLessonTitleChange,
  onBodyMdxChange,
  onClearBodyMdx
}: AuthoringChapterSectionProps) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,var(--showcase-surface),var(--surface))]">
      <CardHeader className="border-b border-[var(--border-soft)] bg-[var(--showcase-surface-soft)]">
        <CardTitle>Chapter</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Pick the chapter this assignment belongs to, or create the next chapter for the selected course.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 p-6">
        <Field label="Chapter">
          <select
            value={selection}
            onChange={(event) => onSelectionChange(event.target.value)}
            className="flex h-12 w-full rounded-2xl border border-[var(--field-border)] bg-[var(--field-surface)] px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Chapter title">
          <Input value={lessonTitle} onChange={(event) => onLessonTitleChange(event.target.value)} placeholder="Variables" required />
        </Field>

        <p className="rounded-[1.5rem] bg-[var(--surface-hover)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Chapter URL:{" "}
          <span className="font-mono text-[var(--ink-strong)]">
            /learn/{resolvedCourseSlug || "new-course"}/{resolvedLessonSlug || "new-chapter"}
          </span>
        </p>

        <AuthoringCodeFenceField
          label="Chapter guide (optional)"
          name="bodyMdx"
          rows={16}
          value={bodyMdx}
          onChange={onBodyMdxChange}
          onClear={onClearBodyMdx}
          placeholder={"Optional background for the whole chapter.\n\nLeave it blank if each assignment should stand on its own."}
          emptyActionLabel="No chapter guide"
          helperText="Code examples render in a read-only code panel on the learner page. This chapter guide is optional: when present, learners can open it separately from the assignment reading."
        />
      </CardContent>
    </Card>
  )
}
