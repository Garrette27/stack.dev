"use client"

import { useActionState } from "react"

import { upsertAuthoringBundleAction, type AuthoringActionState } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const initialState: AuthoringActionState = {
  success: false,
  message: ""
}

export function AuthoringForm() {
  const [state, formAction, pending] = useActionState(upsertAuthoringBundleAction, initialState)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.66)]">
        <CardTitle>Create lesson + challenge</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Fill this once, save it, then open the learner page. The only public parts are the lesson text, question, and starter code.
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 p-6">
        <form action={formAction} className="grid gap-8">
          <section className="grid gap-4 rounded-[1.75rem] bg-[color:rgb(25_31_45/0.04)] p-5 text-sm leading-7 text-[var(--ink)] md:grid-cols-2">
            <div>
              <p className="font-semibold text-[var(--ink-strong)]">Public</p>
              <p className="mt-1">Lesson title, lesson text, public question, and starter code.</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink-strong)]">Private</p>
              <p className="mt-1">Reference solution and hidden tests. Judge0 only matters when you run checks.</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Field label="Course title">
              <Input name="courseTitle" placeholder="Backend Foundations" required />
            </Field>
            <Field label="Course slug" hint="Used in the URL, for example backend-foundations">
              <Input name="courseSlug" placeholder="backend-foundations" required />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Field label="Lesson title" hint="This is the heading the learner sees in the course and lesson page.">
              <Input name="lessonTitle" placeholder="Functions and feedback loops" required />
            </Field>
            <Field label="Lesson slug" hint="Short URL name for this lesson.">
              <Input name="lessonSlug" placeholder="functions-and-feedback" required />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Field label="Lesson summary" className="md:col-span-2">
              <Input name="lessonSummary" placeholder="What the learner should remember after this exercise." required />
            </Field>
            <Field label="Minutes">
              <Input name="estimatedMinutes" type="number" min="1" defaultValue="10" required />
            </Field>
          </section>

          <Field
            label="Lesson reading text (MDX)"
            hint="This is the explanation part the learner reads before answering the coding question."
          >
            <Textarea
              name="bodyMdx"
              rows={14}
              placeholder={"# What this lesson teaches\n\nExplain the concept in a few paragraphs.\n\n- Keep it short\n- Keep it focused"}
              required
            />
          </Field>

          <section className="grid gap-4 md:grid-cols-3">
            <Field label="Question title" hint="Short title shown above the public coding question." className="md:col-span-2">
              <Input name="challengeTitle" placeholder="Write a greeting function" required />
            </Field>
            <Field label="Question slug" hint="URL-safe id for the coding challenge.">
              <Input name="challengeSlug" placeholder="python-greet-user" required />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Field label="Answer language" hint="Language the learner will write their answer in.">
              <select
                name="language"
                defaultValue="python"
                className={cn(
                  "flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
                )}
              >
                <option value="python">python</option>
                <option value="javascript">javascript</option>
              </select>
            </Field>
            <Field label="Judge0 language id" hint="Needed only for real code execution. Python 3 is 71 in the current setup.">
              <Input name="judge0LanguageId" type="number" defaultValue="71" required />
            </Field>
          </section>

          <Field
            label="Public question / prompt (MDX)"
            hint="This is the exact coding question shown to the learner above the editor."
          >
            <Textarea
              name="promptMdx"
              rows={10}
              placeholder={"Describe the task clearly.\n\n- Input requirements\n- Expected behavior\n- Edge cases"}
              required
            />
          </Field>

          <section className="grid gap-4 lg:grid-cols-2">
            <Field label="Starter answer code" hint="This pre-fills the learner editor so they know where to write the solution.">
              <Textarea
                name="starterCode"
                rows={14}
                placeholder={"def solve(value):\n    raise NotImplementedError('implement me')"}
                required
              />
            </Field>
            <Field label="Reference solution (private)" hint="Used for your internal answer key only. The learner does not see this.">
              <Textarea
                name="solutionCode"
                rows={14}
                placeholder={"def solve(value):\n    return value"}
                required
              />
            </Field>
          </section>

          <Field
            label="Hidden checker tests (private)"
            hint="Write assertions that must pass. This is the real correctness check run on the server."
          >
            <Textarea
              name="hiddenTestCode"
              rows={12}
              placeholder={'assert greet("Ada") == "Hello, Ada!"\nassert greet("Rico") == "Hello, Rico!"'}
              required
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save question and lesson"}
            </Button>
            {state.message ? (
              <p className={state.success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
