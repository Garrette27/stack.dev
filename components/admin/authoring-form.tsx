"use client"

import { useActionState, useEffect, useMemo, useState } from "react"

import { upsertAuthoringBundleAction, type AuthoringActionState } from "@/app/admin/actions"
import { MultipleChoiceOptionsEditor } from "@/components/admin/multiple-choice-options-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createDefaultMultipleChoiceOptions, ensureMultipleChoiceOptionShape } from "@/lib/challenges/multiple-choice"
import { getEffectiveAssignmentReading, getEffectiveAssignmentReadingLabel } from "@/lib/content/reading"
import {
  AUTHORING_LANGUAGE_OPTIONS,
  getCodeFenceSnippet,
  getDefaultJudge0LanguageId,
  getHiddenTestTemplate,
  getStarterTemplate,
  getSolutionTemplate
} from "@/lib/judge0/languages"
import type { Challenge, ChallengeKind, ContentSnapshot, Lesson, MultipleChoiceOption } from "@/lib/types"
import { slugify } from "@/lib/utils"

const NEW_COURSE = "__new_course__"
const NEW_CHAPTER = "__new_chapter__"
const NEW_ASSIGNMENT = "__new_assignment__"

const initialState: AuthoringActionState = {
  success: false,
  message: ""
}

type AuthoringFormProps = {
  snapshot: ContentSnapshot
}

function getAssignmentLabel(challenge: Challenge, index: number) {
  const normalizedTitle = challenge.title.replace(/^assignment[:\s-]*/i, "").trim()
  const safeTitle = normalizedTitle || `Assignment ${index + 1}`
  const shortTitle = safeTitle.length > 34 ? `${safeTitle.slice(0, 31).trimEnd()}...` : safeTitle
  return `A${index + 1}: ${shortTitle}`
}

function appendCodeFence(source: string, language: NonNullable<Challenge["language"]>) {
  const { label, example } = getCodeFenceSnippet(language)
  const trimmed = source.trimEnd()
  const prefix = trimmed ? "\n\n" : ""

  return `${trimmed}${prefix}\`\`\`${label}\n${example}\n\`\`\`\n`
}

function getLessonsForCourse(snapshot: ContentSnapshot, courseId: string | null) {
  if (!courseId) {
    return []
  }

  return snapshot.lessons.filter((lesson) => lesson.courseId === courseId).sort((left, right) => left.orderIndex - right.orderIndex)
}

function getChallengesForLesson(snapshot: ContentSnapshot, lesson: Lesson | null) {
  if (!lesson) {
    return []
  }

  return lesson.challengeIds
    .map((challengeId) => snapshot.challenges.find((challenge) => challenge.id === challengeId) ?? null)
    .filter((challenge): challenge is Challenge => Boolean(challenge))
}

/**
 * Loads the selected assignment draft into the form so authors can revise one
 * assignment at a time without manually syncing every field.
 */
function loadAssignmentDraft(
  challenge: Challenge,
  setters: {
    setChallengeKind: (value: ChallengeKind) => void
    setLanguage: (value: NonNullable<Challenge["language"]>) => void
    setJudge0LanguageId: (value: string) => void
    setReadingMdx: (value: string) => void
    setPromptMdx: (value: string) => void
    setStarterCode: (value: string) => void
    setSolutionCode: (value: string) => void
    setHiddenTestCode: (value: string) => void
    setChoiceOptions: (value: MultipleChoiceOption[]) => void
    setCorrectChoiceKey: (value: string) => void
    setChoiceExplanationMdx: (value: string) => void
  }
) {
  setters.setChallengeKind(challenge.kind)
  setters.setLanguage(challenge.language ?? "javascript")
  setters.setJudge0LanguageId(String(challenge.judge0LanguageId ?? getDefaultJudge0LanguageId("javascript")))
  setters.setReadingMdx(challenge.readingMdx)
  setters.setPromptMdx(challenge.promptMdx)
  setters.setStarterCode(challenge.starterCode)
  setters.setSolutionCode(challenge.solutionCode)
  setters.setHiddenTestCode(challenge.hiddenTestCode)
  setters.setChoiceOptions(ensureMultipleChoiceOptionShape(challenge.choiceOptions))
  setters.setCorrectChoiceKey(challenge.correctChoiceKey ?? challenge.choiceOptions[0]?.key ?? "")
  setters.setChoiceExplanationMdx(challenge.choiceExplanationMdx)
}

/**
 * Presents authoring in product terms: course, chapter, and assignment.
 * The form keeps routing and internal challenge identity hidden behind generated fields.
 */
export function AuthoringForm({ snapshot }: AuthoringFormProps) {
  const [state, formAction, pending] = useActionState(upsertAuthoringBundleAction, initialState)

  const initialCourse = snapshot.courses[0] ?? null
  const initialLessons = getLessonsForCourse(snapshot, initialCourse?.id ?? null)
  const initialLesson = initialLessons[0] ?? null

  const [courseSelection, setCourseSelection] = useState(initialCourse?.slug ?? NEW_COURSE)
  const [lessonSelection, setLessonSelection] = useState(initialLesson?.slug ?? NEW_CHAPTER)
  const [assignmentSelection, setAssignmentSelection] = useState(NEW_ASSIGNMENT)

  const [courseTitle, setCourseTitle] = useState(initialCourse?.title ?? "")
  const [lessonTitle, setLessonTitle] = useState(initialLesson?.title ?? "")
  const [bodyMdx, setBodyMdx] = useState(initialLesson?.bodyMdx ?? "")

  const [challengeKind, setChallengeKind] = useState<ChallengeKind>("code")
  const [language, setLanguage] = useState<NonNullable<Challenge["language"]>>("javascript")
  const [judge0LanguageId, setJudge0LanguageId] = useState(String(getDefaultJudge0LanguageId("javascript")))
  const [readingMdx, setReadingMdx] = useState("")
  const [promptMdx, setPromptMdx] = useState("")
  const [starterCode, setStarterCode] = useState(getStarterTemplate("javascript"))
  const [solutionCode, setSolutionCode] = useState(getSolutionTemplate("javascript"))
  const [hiddenTestCode, setHiddenTestCode] = useState(getHiddenTestTemplate("javascript"))
  const [choiceOptions, setChoiceOptions] = useState<MultipleChoiceOption[]>(createDefaultMultipleChoiceOptions())
  const [correctChoiceKey, setCorrectChoiceKey] = useState(createDefaultMultipleChoiceOptions()[0]?.key ?? "")
  const [choiceExplanationMdx, setChoiceExplanationMdx] = useState("")

  const selectedCourse = useMemo(
    () => snapshot.courses.find((course) => course.slug === courseSelection) ?? null,
    [courseSelection, snapshot.courses]
  )
  const courseLessons = useMemo(
    () => getLessonsForCourse(snapshot, selectedCourse?.id ?? null),
    [selectedCourse?.id, snapshot]
  )
  const selectedLesson = useMemo(
    () => courseLessons.find((lesson) => lesson.slug === lessonSelection) ?? null,
    [courseLessons, lessonSelection]
  )
  const chapterAssignments = useMemo(
    () => getChallengesForLesson(snapshot, selectedLesson),
    [selectedLesson, snapshot]
  )
  const selectedAssignment = useMemo(
    () => chapterAssignments.find((challenge) => challenge.slug === assignmentSelection) ?? null,
    [assignmentSelection, chapterAssignments]
  )
  const learnerReadingPreview = useMemo(
    () =>
      getEffectiveAssignmentReading({
        lessonBodyMdx: bodyMdx,
        challengeReadingMdx: readingMdx,
        challengePromptMdx: promptMdx
      }),
    [bodyMdx, promptMdx, readingMdx]
  )
  const learnerReadingLabel = useMemo(
    () =>
      getEffectiveAssignmentReadingLabel({
        challengeReadingMdx: readingMdx,
        challengePromptMdx: promptMdx
      }),
    [promptMdx, readingMdx]
  )

  const resetCodeAssignmentDraft = (nextLanguage: NonNullable<Challenge["language"]>) => {
    setChallengeKind("code")
    setLanguage(nextLanguage)
    setJudge0LanguageId(String(getDefaultJudge0LanguageId(nextLanguage)))
    setReadingMdx("")
    setPromptMdx("")
    setStarterCode(getStarterTemplate(nextLanguage))
    setSolutionCode(getSolutionTemplate(nextLanguage))
    setHiddenTestCode(getHiddenTestTemplate(nextLanguage))
    const defaultOptions = createDefaultMultipleChoiceOptions()
    setChoiceOptions(defaultOptions)
    setCorrectChoiceKey(defaultOptions[0]?.key ?? "")
    setChoiceExplanationMdx("")
  }

  const resetMultipleChoiceAssignmentDraft = () => {
    const defaultOptions = createDefaultMultipleChoiceOptions()

    setChallengeKind("multiple_choice")
    setReadingMdx("")
    setPromptMdx("")
    setStarterCode("")
    setSolutionCode("")
    setHiddenTestCode("")
    setChoiceOptions(defaultOptions)
    setCorrectChoiceKey(defaultOptions[0]?.key ?? "")
    setChoiceExplanationMdx("")
  }

  const handleChallengeKindChange = (nextKind: ChallengeKind) => {
    if (nextKind === "multiple_choice") {
      resetMultipleChoiceAssignmentDraft()
      return
    }

    resetCodeAssignmentDraft(language)
  }

  useEffect(() => {
    if (!selectedCourse) {
      setCourseTitle("")
      setLessonSelection(NEW_CHAPTER)
      return
    }

    setCourseTitle(selectedCourse.title)
    const nextLesson = courseLessons[0] ?? null
    setLessonSelection(nextLesson?.slug ?? NEW_CHAPTER)
  }, [courseSelection, selectedCourse, courseLessons])

  useEffect(() => {
    if (!selectedLesson) {
      setLessonTitle("")
      setBodyMdx("")
      setAssignmentSelection(NEW_ASSIGNMENT)
      resetCodeAssignmentDraft("javascript")
      return
    }

    setLessonTitle(selectedLesson.title)
    setBodyMdx(selectedLesson.bodyMdx)
    setAssignmentSelection(NEW_ASSIGNMENT)
    resetCodeAssignmentDraft("javascript")
  }, [lessonSelection, selectedLesson])

  const resolvedCourseSlug = selectedCourse?.slug ?? slugify(courseTitle)
  const resolvedLessonSlug = selectedLesson?.slug ?? slugify(lessonTitle)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.66)]">
        <CardTitle>Create chapter + assignment</CardTitle>
        <p className="text-sm leading-7 text-[var(--ink-muted)]">
          Choose a course, choose a chapter, then attach one assignment to that chapter.
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 p-6">
        <form action={formAction} className="grid gap-8">
          <input type="hidden" name="courseTitle" value={courseTitle} readOnly />
          <input type="hidden" name="courseSlug" value={resolvedCourseSlug} readOnly />
          <input type="hidden" name="lessonTitle" value={lessonTitle} readOnly />
          <input type="hidden" name="lessonSlug" value={resolvedLessonSlug} readOnly />
          <input type="hidden" name="challengeSlug" value={selectedAssignment?.slug ?? ""} readOnly />
          <input type="hidden" name="kind" value={challengeKind} readOnly />
          <input type="hidden" name="choiceOptionsJson" value={JSON.stringify(choiceOptions)} readOnly />
          <input type="hidden" name="choiceCorrectKey" value={correctChoiceKey} readOnly />
          <input type="hidden" name="choiceExplanationMdx" value={choiceExplanationMdx} readOnly />

          <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,241,0.9))]">
            <CardHeader className="border-b border-black/6 bg-white/70">
              <CardTitle>Course</CardTitle>
              <p className="text-sm leading-7 text-[var(--ink-muted)]">Choose the course this chapter belongs to, or rename the current course before adding the next chapter.</p>
            </CardHeader>
            <CardContent className="grid gap-5 p-6">
              <Field label="Course">
                <select
                  value={courseSelection}
                  onChange={(event) => setCourseSelection(event.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
                >
                  {snapshot.courses.map((course, index) => (
                    <option key={course.id} value={course.slug}>
                      {`L${index + 1}: ${course.title}`}
                    </option>
                  ))}
                  <option value={NEW_COURSE}>Create new course</option>
                </select>
              </Field>

              <Field label="Course title">
                <Input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Learn JavaScript for Beginners" required />
              </Field>

              <p className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                Course URL: <span className="font-mono text-[var(--ink-strong)]">/learn/{resolvedCourseSlug || "new-course"}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.92))]">
            <CardHeader className="border-b border-black/6 bg-white/70">
              <CardTitle>Chapter</CardTitle>
              <p className="text-sm leading-7 text-[var(--ink-muted)]">Pick the chapter this assignment belongs to, or create the next chapter for the selected course.</p>
            </CardHeader>
            <CardContent className="grid gap-5 p-6">
              <Field label="Chapter">
                <select
                  value={lessonSelection}
                  onChange={(event) => setLessonSelection(event.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
                >
                  {courseLessons.map((lesson, index) => (
                    <option key={lesson.id} value={lesson.slug}>
                      {`CH${index + 1}: ${lesson.title}`}
                    </option>
                  ))}
                  <option value={NEW_CHAPTER}>Create new chapter</option>
                </select>
              </Field>

              <Field label="Chapter title">
                <Input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="Variables" required />
              </Field>

              <p className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                Chapter URL:{" "}
                <span className="font-mono text-[var(--ink-strong)]">
                  /learn/{resolvedCourseSlug || "new-course"}/{resolvedLessonSlug || "new-chapter"}
                </span>
              </p>

              <Field label="Chapter reading (MDX)">
                <Textarea
                  name="bodyMdx"
                  rows={16}
                  value={bodyMdx}
                  onChange={(event) => setBodyMdx(event.target.value)}
                  placeholder={"# Variables\n\nExplain the concept clearly.\n\n- Keep it short\n- Keep it practical"}
                  required
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  {AUTHORING_LANGUAGE_OPTIONS.map((option) => (
                    <Button
                      key={`chapter-fence-${option}`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setBodyMdx((current) => appendCodeFence(current, option))}
                    >
                      {`Insert ${option} code block`}
                    </Button>
                  ))}
                </div>
                <p className="text-sm leading-7 text-[var(--ink-muted)]">
                  Code examples render in a read-only code panel on the learner page. These buttons insert the fenced Markdown for you.
                  Chapter reading stays chapter-scoped; assignment-specific reading is edited below.
                </p>
              </Field>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,241,0.94))]">
            <CardHeader className="border-b border-black/6 bg-white/72">
              <CardTitle>Assignment</CardTitle>
              <p className="text-sm leading-7 text-[var(--ink-muted)]">Add a new assignment to this chapter, or load one of the existing assignments to revise it.</p>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <Field label="Assignment">
                <select
                  value={assignmentSelection}
                  onChange={(event) => {
                    const nextAssignment = event.target.value
                    setAssignmentSelection(nextAssignment)

                    if (nextAssignment === NEW_ASSIGNMENT) {
                      if (challengeKind === "multiple_choice") {
                        resetMultipleChoiceAssignmentDraft()
                      } else {
                        resetCodeAssignmentDraft(language)
                      }
                      return
                    }

                    const nextSelectedAssignment =
                      chapterAssignments.find((challenge) => challenge.slug === nextAssignment) ?? null

                    if (nextSelectedAssignment) {
                      loadAssignmentDraft(nextSelectedAssignment, {
                        setChallengeKind,
                        setLanguage,
                        setJudge0LanguageId,
                        setReadingMdx,
                        setPromptMdx,
                        setStarterCode,
                        setSolutionCode,
                        setHiddenTestCode,
                        setChoiceOptions,
                        setCorrectChoiceKey,
                        setChoiceExplanationMdx
                      })
                    }
                  }}
                  className="flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
                >
                  <option value={NEW_ASSIGNMENT}>Create new assignment</option>
                  {chapterAssignments.map((challenge, index) => (
                    <option key={challenge.id} value={challenge.slug}>
                      {getAssignmentLabel(challenge, index)}
                    </option>
                  ))}
                </select>
              </Field>

              <p className="rounded-[1.5rem] bg-[color:rgb(25_31_45/0.04)] px-4 py-3 text-sm text-[var(--ink-muted)]">
                The assignment slug is generated for you when you create a new assignment. Pick an existing assignment above to revise it.
              </p>

              <div className="rounded-[1.5rem] border border-black/8 bg-[color:rgb(25_31_45/0.03)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Learner reading preview</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
                      Switching assignments changes this preview immediately. Chapter reading stays in the chapter editor above; this preview shows what the learner will actually read for the selected assignment.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)] ring-1 ring-black/8">
                    {learnerReadingLabel}
                  </span>
                </div>
                <Textarea
                  rows={10}
                  value={learnerReadingPreview}
                  readOnly
                  className="mt-4 cursor-default bg-white/80 text-[var(--ink)]"
                />
              </div>

              <Field label="Assignment type">
                <select
                  value={challengeKind}
                  onChange={(event) => handleChallengeKindChange(event.target.value as ChallengeKind)}
                  className="flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
                >
                  <option value="code">Code assignment</option>
                  <option value="multiple_choice">Multiple choice</option>
                </select>
              </Field>

              <Field label="Assignment reading (optional)">
                <Textarea
                  name="readingMdx"
                  rows={10}
                  value={readingMdx}
                  onChange={(event) => setReadingMdx(event.target.value)}
                  placeholder={"Use this only when one assignment needs its own reading.\n\nLeave it blank to reuse the assignment prompt as the reading content."}
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  {AUTHORING_LANGUAGE_OPTIONS.map((option) => (
                    <Button
                      key={`assignment-fence-${option}`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setReadingMdx((current) => appendCodeFence(current, option))}
                    >
                      {`Insert ${option} code block`}
                    </Button>
                  ))}
                </div>
              </Field>

              <Field label="Assignment prompt (MDX)">
                <Textarea
                  name="promptMdx"
                  rows={12}
                  value={promptMdx}
                  onChange={(event) => setPromptMdx(event.target.value)}
                  placeholder={"Explain the task clearly.\n\n- What to print or return\n- What matters about the output\n- Any edge cases"}
                  required
                />
              </Field>

              {challengeKind === "code" ? (
                <>
                  <section className="grid gap-5 lg:grid-cols-2">
                    <Field label="Answer language">
                      <select
                        name="language"
                        value={language}
                        onChange={(event) => {
                          const nextLanguage = event.target.value as NonNullable<Challenge["language"]>
                          setLanguage(nextLanguage)
                          setJudge0LanguageId(String(getDefaultJudge0LanguageId(nextLanguage)))
                          setStarterCode(getStarterTemplate(nextLanguage))
                          setSolutionCode(getSolutionTemplate(nextLanguage))
                          setHiddenTestCode(getHiddenTestTemplate(nextLanguage))
                        }}
                        className="flex h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[var(--ink-strong)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgb(201_111_54/0.2)]"
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
                        onChange={(event) => setJudge0LanguageId(event.target.value)}
                        required
                      />
                    </Field>
                  </section>

                  <Field label="Starter code">
                    <Textarea
                      name="starterCode"
                      rows={14}
                      value={starterCode}
                      onChange={(event) => setStarterCode(event.target.value)}
                      required
                    />
                  </Field>

                  <Field label="Reference solution">
                    <Textarea
                      name="solutionCode"
                      rows={14}
                      value={solutionCode}
                      onChange={(event) => setSolutionCode(event.target.value)}
                      required
                    />
                  </Field>

                  <Field label="Hidden checker tests">
                    <Textarea
                      name="hiddenTestCode"
                      rows={12}
                      value={hiddenTestCode}
                      onChange={(event) => setHiddenTestCode(event.target.value)}
                      required
                    />
                  </Field>
                </>
              ) : (
                <MultipleChoiceOptionsEditor
                  options={choiceOptions}
                  correctChoiceKey={correctChoiceKey}
                  explanationMdx={choiceExplanationMdx}
                  onOptionsChange={setChoiceOptions}
                  onCorrectChoiceKeyChange={setCorrectChoiceKey}
                  onExplanationChange={setChoiceExplanationMdx}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save chapter and assignment"}
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
