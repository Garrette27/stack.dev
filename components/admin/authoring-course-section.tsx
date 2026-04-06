"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type SelectOption = {
  value: string
  label: string
}

type AuthoringCourseSectionProps = {
  options: SelectOption[]
  selection: string
  courseTitle: string
  resolvedCourseSlug: string
  onSelectionChange: (value: string) => void
  onCourseTitleChange: (value: string) => void
}

/**
 * Owns the course-scoped authoring inputs so the parent form does not need to
 * know how course selection, naming, and URL preview are rendered.
 */
export function AuthoringCourseSection({
  options,
  selection,
  courseTitle,
  resolvedCourseSlug,
  onSelectionChange,
  onCourseTitleChange
}: AuthoringCourseSectionProps) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,var(--showcase-surface),var(--surface))]">
      <CardHeader className="border-b border-[var(--border-soft)] bg-[var(--showcase-surface-soft)]">
        <CardTitle>Course</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Choose the course this chapter belongs to, or rename the current course before adding the next chapter.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 p-6">
        <Field label="Course">
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

        <Field label="Course title">
          <Input
            value={courseTitle}
            onChange={(event) => onCourseTitleChange(event.target.value)}
            placeholder="Learn JavaScript for Beginners"
            required
          />
        </Field>

        <p className="rounded-[1.5rem] bg-[var(--surface-hover)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Course URL: <span className="font-mono text-[var(--ink-strong)]">/learn/{resolvedCourseSlug || "new-course"}</span>
        </p>
      </CardContent>
    </Card>
  )
}
