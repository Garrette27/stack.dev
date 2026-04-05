"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { upsertAuthoringBundleAction, type AuthoringActionState } from "@/app/admin/actions"
import { MultipleChoiceOptionsEditor } from "@/components/admin/multiple-choice-options-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createDefaultMultipleChoiceOptions, ensureMultipleChoiceOptionShape } from "@/lib/challenges/multiple-choice"
import {
  getEffectiveAssignmentReading,
  getEffectiveAssignmentReadingLabel
} from "@/lib/content/reading"
import {
  buildPersistedAssignmentDraftKey,
  buildPersistedLessonDraftKey,
  readPersistedAssignmentDraft,
  readPersistedLessonDraft,
  readPersistedAuthoringSelection,
  writePersistedAssignmentDraft,
  writePersistedAuthoringSelection,
  writePersistedLessonDraft,
  type PersistedAssignmentDraft,
  type PersistedLessonDraft,
  type PersistedAuthoringSelection
} from "@/lib/admin/authoring-session"
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
  initialSelection?: PersistedAuthoringSelection | null
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

type ResolvedAuthoringTarget = {
  course: ContentSnapshot["courses"][number] | null
  lesson: Lesson | null
  assignment: Challenge | null
}

function resolveAuthoringTarget(
  snapshot: ContentSnapshot,
  selection: PersistedAuthoringSelection | null | undefined
): ResolvedAuthoringTarget {
  const defaultCourse = snapshot.courses[0] ?? null
  const course = selection?.courseSlug
    ? snapshot.courses.find((candidate) => candidate.slug === selection.courseSlug) ?? defaultCourse
    : defaultCourse
  const courseLessons = getLessonsForCourse(snapshot, course?.id ?? null)
  const defaultLesson = courseLessons[0] ?? null
  const lesson = selection?.lessonSlug
    ? courseLessons.find((candidate) => candidate.slug === selection.lessonSlug) ?? defaultLesson
    : defaultLesson
  const lessonAssignments = getChallengesForLesson(snapshot, lesson)
  const assignment =
    selection?.challengeSlug && selection.challengeSlug !== NEW_ASSIGNMENT
      ? lessonAssignments.find((candidate) => candidate.slug === selection.challengeSlug) ?? null
      : null

  return {
    course,
    lesson,
    assignment
  }
}

function buildPersistedLessonDraft({
  courseTitle,
  lessonTitle,
  bodyMdx,
}: PersistedLessonDraft): PersistedLessonDraft {
  return {
    courseTitle,
    lessonTitle,
    bodyMdx
  }
}

function buildPersistedAssignmentDraft({
  challengeKind,
  language,
  judge0LanguageId,
  readingMdx,
  promptMdx,
  starterCode,
  solutionCode,
  hiddenTestCode,
  choiceOptions,
  correctChoiceKey,
  choiceExplanationMdx
}: PersistedAssignmentDraft): PersistedAssignmentDraft {
  return {
    challengeKind,
    language,
    judge0LanguageId,
    readingMdx,
    promptMdx,
    starterCode,
    solutionCode,
    hiddenTestCode,
    choiceOptions,
    correctChoiceKey,
    choiceExplanationMdx
  }
}

function applyPersistedLessonDraft(
  draft: PersistedLessonDraft,
  setters: {
    setCourseTitle: (value: string) => void
    setLessonTitle: (value: string) => void
    setBodyMdx: (value: string) => void
  }
) {
  setters.setCourseTitle(draft.courseTitle)
  setters.setLessonTitle(draft.lessonTitle)
  setters.setBodyMdx(draft.bodyMdx)
}

function applyPersistedAssignmentDraft(
  draft: PersistedAssignmentDraft,
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
  setters.setChallengeKind(draft.challengeKind)
  setters.setLanguage((draft.language as NonNullable<Challenge["language"]>) || "javascript")
  setters.setJudge0LanguageId(draft.judge0LanguageId)
  setters.setReadingMdx(draft.readingMdx)
  setters.setPromptMdx(draft.promptMdx)
  setters.setStarterCode(draft.starterCode)
  setters.setSolutionCode(draft.solutionCode)
  setters.setHiddenTestCode(draft.hiddenTestCode)
  setters.setChoiceOptions(ensureMultipleChoiceOptionShape(draft.choiceOptions))
  setters.setCorrectChoiceKey(draft.correctChoiceKey)
  setters.setChoiceExplanationMdx(draft.choiceExplanationMdx)
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
export function AuthoringForm({ snapshot, initialSelection = null }: AuthoringFormProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(upsertAuthoringBundleAction, initialState)

  const initialTarget = resolveAuthoringTarget(snapshot, initialSelection)
  const initialCourse = initialTarget.course
  const initialLesson = initialTarget.lesson
  const initialAssignment = initialTarget.assignment
  const initialChoiceOptions = initialAssignment
    ? ensureMultipleChoiceOptionShape(initialAssignment.choiceOptions)
    : createDefaultMultipleChoiceOptions()

  const [courseSelection, setCourseSelection] = useState(initialCourse?.slug ?? NEW_COURSE)
  const [lessonSelection, setLessonSelection] = useState(initialLesson?.slug ?? NEW_CHAPTER)
  const [assignmentSelection, setAssignmentSelection] = useState(initialAssignment?.slug ?? NEW_ASSIGNMENT)
  const [lastAppliedSaveSelectionKey, setLastAppliedSaveSelectionKey] = useState("")
  const [selectionHydrated, setSelectionHydrated] = useState(Boolean(initialSelection))

  const [courseTitle, setCourseTitle] = useState(initialCourse?.title ?? "")
  const [lessonTitle, setLessonTitle] = useState(initialLesson?.title ?? "")
  const [bodyMdx, setBodyMdx] = useState(initialLesson?.bodyMdx ?? "")

  const [challengeKind, setChallengeKind] = useState<ChallengeKind>(initialAssignment?.kind ?? "code")
  const [language, setLanguage] = useState<NonNullable<Challenge["language"]>>(initialAssignment?.language ?? "javascript")
  const [judge0LanguageId, setJudge0LanguageId] = useState(
    String(initialAssignment?.judge0LanguageId ?? getDefaultJudge0LanguageId(initialAssignment?.language ?? "javascript"))
  )
  const [readingMdx, setReadingMdx] = useState(initialAssignment?.readingMdx ?? "")
  const [promptMdx, setPromptMdx] = useState(initialAssignment?.promptMdx ?? "")
  const [starterCode, setStarterCode] = useState(
    initialAssignment?.starterCode || getStarterTemplate(initialAssignment?.language ?? "javascript")
  )
  const [solutionCode, setSolutionCode] = useState(
    initialAssignment?.solutionCode || getSolutionTemplate(initialAssignment?.language ?? "javascript")
  )
  const [hiddenTestCode, setHiddenTestCode] = useState(
    initialAssignment?.hiddenTestCode || getHiddenTestTemplate(initialAssignment?.language ?? "javascript")
  )
  const [choiceOptions, setChoiceOptions] = useState<MultipleChoiceOption[]>(initialChoiceOptions)
  const [correctChoiceKey, setCorrectChoiceKey] = useState(
    initialAssignment?.correctChoiceKey ?? initialChoiceOptions[0]?.key ?? ""
  )
  const [choiceExplanationMdx, setChoiceExplanationMdx] = useState(initialAssignment?.choiceExplanationMdx ?? "")
  const restoredSelectionRef = useRef(Boolean(initialSelection))
  const previousLessonSlugRef = useRef<string | null>(initialLesson?.slug ?? null)

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
        lessonBodyMdx: bodyMdx,
        challengeReadingMdx: readingMdx,
        challengePromptMdx: promptMdx
      }),
    [bodyMdx, promptMdx, readingMdx]
  )

  const applyStoredLessonDraft = useCallback((draft: PersistedLessonDraft) => {
    applyPersistedLessonDraft(draft, {
      setCourseTitle,
      setLessonTitle,
      setBodyMdx
    })
  }, [])

  const applyStoredAssignmentDraft = useCallback((draft: PersistedAssignmentDraft) => {
    applyPersistedAssignmentDraft(draft, {
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
  }, [])

  const loadExistingAssignmentDraft = useCallback((challenge: Challenge) => {
    loadAssignmentDraft(challenge, {
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
  }, [])

  const syncSelectionToUrl = useCallback((selection: PersistedAuthoringSelection | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (selection?.courseSlug) {
      params.set("authorCourse", selection.courseSlug)
    } else {
      params.delete("authorCourse")
    }

    if (selection?.lessonSlug) {
      params.set("authorLesson", selection.lessonSlug)
    } else {
      params.delete("authorLesson")
    }

    if (selection?.challengeSlug) {
      params.set("authorAssignment", selection.challengeSlug)
    } else {
      params.delete("authorAssignment")
    }

    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const rememberSelection = useCallback((selection: PersistedAuthoringSelection | null) => {
    writePersistedAuthoringSelection(selection)
    syncSelectionToUrl(selection)
  }, [syncSelectionToUrl])

  const buildSelection = useCallback(
    (challengeSlug: string, override?: Partial<PersistedAuthoringSelection>) => {
      const courseSlug =
        override?.courseSlug ??
        selectedCourse?.slug ??
        (courseSelection === NEW_COURSE ? slugify(courseTitle) : courseSelection)
      const lessonSlug =
        override?.lessonSlug ??
        selectedLesson?.slug ??
        (lessonSelection === NEW_CHAPTER ? slugify(lessonTitle) : lessonSelection)

      if (!courseSlug || !lessonSlug) {
        return null
      }

      return {
        courseSlug,
        lessonSlug,
        challengeSlug: override?.challengeSlug ?? challengeSlug
      } satisfies PersistedAuthoringSelection
    },
    [courseSelection, courseTitle, lessonSelection, lessonTitle, selectedCourse?.slug, selectedLesson?.slug]
  )

  const loadPersistedLessonDraftForSelection = useCallback(
    (selection: PersistedAuthoringSelection | null) => {
      if (!selection) {
        return false
      }

      const storedDraft = readPersistedLessonDraft(
        buildPersistedLessonDraftKey({
          courseSlug: selection.courseSlug,
          lessonSlug: selection.lessonSlug
        })
      )
      if (!storedDraft) {
        return false
      }

      applyStoredLessonDraft(storedDraft)
      return true
    },
    [applyStoredLessonDraft]
  )

  const loadPersistedAssignmentDraftForSelection = useCallback(
    (selection: PersistedAuthoringSelection | null) => {
      if (!selection) {
        return false
      }

      const storedDraft = readPersistedAssignmentDraft(buildPersistedAssignmentDraftKey(selection))
      if (!storedDraft) {
        return false
      }

      applyStoredAssignmentDraft(storedDraft)
      return true
    },
    [applyStoredAssignmentDraft]
  )

  const openExistingAssignment = useCallback((
    challenge: Challenge,
    selectionOverride?: PersistedAuthoringSelection | null
  ) => {
    const nextSelection = selectionOverride ?? buildSelection(challenge.slug)

    setAssignmentSelection(challenge.slug)

    if (nextSelection) {
      rememberSelection(nextSelection)
    }

    if (!loadPersistedLessonDraftForSelection(nextSelection) && selectedLesson) {
      setCourseTitle(selectedCourse?.title ?? courseTitle)
      setLessonTitle(selectedLesson.title)
      setBodyMdx(selectedLesson.bodyMdx)
    }

    if (loadPersistedAssignmentDraftForSelection(nextSelection)) {
      return
    }

    loadExistingAssignmentDraft(challenge)
  }, [
    buildSelection,
    courseTitle,
    loadExistingAssignmentDraft,
    loadPersistedAssignmentDraftForSelection,
    loadPersistedLessonDraftForSelection,
    rememberSelection,
    selectedCourse?.title,
    selectedLesson
  ])

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

  const openNewAssignmentDraft = useCallback((selectionOverride?: PersistedAuthoringSelection | null) => {
    const nextSelection = selectionOverride ?? buildSelection(NEW_ASSIGNMENT)

    setAssignmentSelection(NEW_ASSIGNMENT)
    if (nextSelection) {
      rememberSelection(nextSelection)
    }

    if (!loadPersistedLessonDraftForSelection(nextSelection) && selectedLesson) {
      setCourseTitle(selectedCourse?.title ?? courseTitle)
      setLessonTitle(selectedLesson.title)
      setBodyMdx(selectedLesson.bodyMdx)
    }

    if (loadPersistedAssignmentDraftForSelection(nextSelection)) {
      return
    }

    if (challengeKind === "multiple_choice") {
      resetMultipleChoiceAssignmentDraft()
      return
    }

    resetCodeAssignmentDraft(language)
  }, [
    buildSelection,
    challengeKind,
    courseTitle,
    language,
    loadPersistedAssignmentDraftForSelection,
    loadPersistedLessonDraftForSelection,
    rememberSelection,
    selectedCourse?.title,
    selectedLesson
  ])

  useEffect(() => {
    if (!selectionHydrated) {
      return
    }

    if (!selectedCourse) {
      setCourseTitle("")
      setLessonSelection(NEW_CHAPTER)
      return
    }

    setCourseTitle(selectedCourse.title)
    const nextLesson =
      courseLessons.find((lesson) => lesson.slug === lessonSelection) ??
      courseLessons[0] ??
      null
    setLessonSelection(nextLesson?.slug ?? NEW_CHAPTER)
  }, [courseSelection, courseLessons, lessonSelection, selectedCourse, selectionHydrated])

  useEffect(() => {
    if (!selectionHydrated) {
      return
    }

    const currentLessonSlug = selectedLesson?.slug ?? null
    const lessonChanged = previousLessonSlugRef.current !== currentLessonSlug
    previousLessonSlugRef.current = currentLessonSlug

    if (!selectedLesson) {
      setLessonTitle("")
      setBodyMdx("")
      openNewAssignmentDraft()
      return
    }

    if (lessonChanged) {
      const chapterSelection = buildSelection(assignmentSelection, {
        courseSlug: selectedCourse?.slug ?? undefined,
        lessonSlug: selectedLesson.slug
      })

      if (!loadPersistedLessonDraftForSelection(chapterSelection)) {
        setCourseTitle(selectedCourse?.title ?? "")
        setLessonTitle(selectedLesson.title)
        setBodyMdx(selectedLesson.bodyMdx)
      }

      const firstAssignment = chapterAssignments[0] ?? null
      if (firstAssignment) {
        openExistingAssignment(firstAssignment)
        return
      }

      openNewAssignmentDraft(
        buildSelection(NEW_ASSIGNMENT, {
          courseSlug: selectedCourse?.slug ?? undefined,
          lessonSlug: selectedLesson.slug
        })
      )
      return
    }

    if (assignmentSelection === NEW_ASSIGNMENT) {
      return
    }

    const currentAssignment =
      chapterAssignments.find((challenge) => challenge.slug === assignmentSelection) ?? null

    if (currentAssignment) {
      return
    }

    const fallbackAssignment = chapterAssignments[0] ?? null
    if (fallbackAssignment) {
      openExistingAssignment(fallbackAssignment)
      return
    }

    openNewAssignmentDraft()
  }, [
    assignmentSelection,
    buildSelection,
    chapterAssignments,
    loadPersistedLessonDraftForSelection,
    openExistingAssignment,
    openNewAssignmentDraft,
    selectedCourse?.slug,
    selectedCourse?.title,
    selectedLesson,
    selectionHydrated
  ])

  useEffect(() => {
    if (restoredSelectionRef.current) {
      return
    }

    restoredSelectionRef.current = true

    const storedSelection = readPersistedAuthoringSelection()
    if (!storedSelection) {
      setSelectionHydrated(true)
      return
    }

    const storedCourse = snapshot.courses.find((course) => course.slug === storedSelection.courseSlug) ?? null
    const storedLessons = getLessonsForCourse(snapshot, storedCourse?.id ?? null)
    const storedLesson = storedLessons.find((lesson) => lesson.slug === storedSelection.lessonSlug) ?? null
    const storedAssignments = getChallengesForLesson(snapshot, storedLesson)
    const storedAssignment =
      storedAssignments.find((challenge) => challenge.slug === storedSelection.challengeSlug) ?? null

    if (!storedCourse || !storedLesson || !storedAssignment) {
      rememberSelection(null)
      const fallbackSelection =
        initialLesson && initialCourse
          ? {
              courseSlug: initialCourse.slug,
              lessonSlug: initialLesson.slug,
              challengeSlug: initialAssignment?.slug ?? NEW_ASSIGNMENT
            }
          : null

      if (initialAssignment) {
        openExistingAssignment(initialAssignment, fallbackSelection)
      } else {
        openNewAssignmentDraft(fallbackSelection)
      }
      setSelectionHydrated(true)
      return
    }

    setCourseSelection(storedSelection.courseSlug)
    setLessonSelection(storedSelection.lessonSlug)
    openExistingAssignment(storedAssignment, storedSelection)
    setSelectionHydrated(true)
  }, [initialAssignment, initialCourse, initialLesson, openExistingAssignment, openNewAssignmentDraft, rememberSelection, snapshot])

  useEffect(() => {
    if (!state.success || !state.savedCourseSlug || !state.savedLessonSlug || !state.savedChallengeSlug) {
      return
    }

    const saveSelectionKey = `${state.savedCourseSlug}|${state.savedLessonSlug}|${state.savedChallengeSlug}|${state.message}`
    if (saveSelectionKey === lastAppliedSaveSelectionKey) {
      return
    }

    setLastAppliedSaveSelectionKey(saveSelectionKey)

    const savedSelection = {
      courseSlug: state.savedCourseSlug,
      lessonSlug: state.savedLessonSlug,
      challengeSlug: state.savedChallengeSlug
    } satisfies PersistedAuthoringSelection

    setCourseSelection(savedSelection.courseSlug)
    setLessonSelection(savedSelection.lessonSlug)
    setAssignmentSelection(savedSelection.challengeSlug)
    setSelectionHydrated(true)
    rememberSelection(savedSelection)
    router.refresh()
  }, [lastAppliedSaveSelectionKey, rememberSelection, router, state])

  const resolvedCourseSlug = selectedCourse?.slug ?? slugify(courseTitle)
  const resolvedLessonSlug = selectedLesson?.slug ?? slugify(lessonTitle)
  const currentDraftSelection = useMemo(() => {
    const courseSlug = selectedCourse?.slug ?? resolvedCourseSlug
    const lessonSlug = selectedLesson?.slug ?? resolvedLessonSlug

    if (!courseSlug || !lessonSlug) {
      return null
    }

    return {
      courseSlug,
      lessonSlug,
      challengeSlug: assignmentSelection
    } satisfies PersistedAuthoringSelection
  }, [assignmentSelection, resolvedCourseSlug, resolvedLessonSlug, selectedCourse?.slug, selectedLesson?.slug])

  useEffect(() => {
    if (!currentDraftSelection || !selectionHydrated) {
      return
    }

    writePersistedLessonDraft(
      buildPersistedLessonDraftKey({
        courseSlug: currentDraftSelection.courseSlug,
        lessonSlug: currentDraftSelection.lessonSlug
      }),
      buildPersistedLessonDraft({
        courseTitle,
        lessonTitle,
        bodyMdx
      })
    )
  }, [bodyMdx, courseTitle, currentDraftSelection, lessonTitle, selectionHydrated])

  useEffect(() => {
    if (!currentDraftSelection || !selectionHydrated) {
      return
    }

    writePersistedAssignmentDraft(
      buildPersistedAssignmentDraftKey(currentDraftSelection),
      buildPersistedAssignmentDraft({
        challengeKind,
        language,
        judge0LanguageId,
        readingMdx,
        promptMdx,
        starterCode,
        solutionCode,
        hiddenTestCode,
        choiceOptions,
        correctChoiceKey,
        choiceExplanationMdx
      })
    )
  }, [
    challengeKind,
    choiceExplanationMdx,
    choiceOptions,
    correctChoiceKey,
    currentDraftSelection,
    hiddenTestCode,
    judge0LanguageId,
    language,
    promptMdx,
    readingMdx,
    selectionHydrated,
    solutionCode,
    starterCode
  ])

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
          <input type="hidden" name="challengeSlug" value={assignmentSelection === NEW_ASSIGNMENT ? "" : assignmentSelection} readOnly />
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

              <Field label="Chapter reading (shared across this chapter)">
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
                  Edits here affect every assignment in this chapter; use the assignment reading field below only when one assignment needs its own study text.
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

                    if (nextAssignment === NEW_ASSIGNMENT) {
                      openNewAssignmentDraft()
                      return
                    }

                    const nextSelectedAssignment =
                      chapterAssignments.find((challenge) => challenge.slug === nextAssignment) ?? null

                    if (nextSelectedAssignment) {
                      openExistingAssignment(nextSelectedAssignment)
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
                Existing assignments stay selected after you save, so you can keep refining the same work without accidentally creating duplicates.
              </p>

              <div className="rounded-[1.5rem] border border-black/8 bg-[color:rgb(25_31_45/0.03)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Learner reading preview</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
                      Switching assignments changes this preview immediately. Chapter reading stays in the chapter editor above; this preview shows what the learner will actually read for the selected assignment.
                    </p>
                    {learnerReadingLabel === "Shared chapter reading" ? (
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
                        This assignment is using the shared chapter guide right now. Add assignment reading below only if
                        this one question needs its own study text.
                      </p>
                    ) : null}
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

              <div className="rounded-[1.5rem] border border-black/8 bg-[color:rgb(25_31_45/0.03)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">Publishing workflow</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">
                      Drafts stay visible in admin so you can keep iterating. Publishing promotes the selected draft to the live learner version for this assignment.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)] ring-1 ring-black/8">
                    {selectedAssignment ? selectedAssignment.publicationState.replace("_", " ") : "new draft"}
                  </span>
                </div>
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

              <Field label="Assignment reading (optional, only for the selected assignment)">
                <Textarea
                  name="readingMdx"
                  rows={10}
                  value={readingMdx}
                  onChange={(event) => setReadingMdx(event.target.value)}
                  placeholder={"Use this only when one assignment needs its own reading.\n\nLeave it blank to reuse the chapter reading above."}
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setReadingMdx("")}
                  >
                    Use chapter reading
                  </Button>
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
                <p className="text-sm leading-7 text-[var(--ink-muted)]">
                  Leave this blank when the assignment should use the chapter reading. Fill it only when one assignment needs its own study text.
                </p>
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
            <Button type="submit" name="saveMode" value="publish" disabled={pending}>
              {pending ? "Saving..." : "Publish chapter and assignment"}
            </Button>
            <Button type="submit" name="saveMode" value="draft" variant="secondary" disabled={pending}>
              {pending ? "Saving..." : "Save draft"}
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
