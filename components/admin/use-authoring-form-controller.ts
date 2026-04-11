"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { upsertAuthoringBundleAction, type AuthoringActionState } from "@/app/admin/actions"
import {
  buildPersistedAssignmentDraftKey,
  buildPersistedLessonDraftKey,
  readPersistedAssignmentDraft,
  readPersistedAuthoringSelection,
  readPersistedLessonDraft,
  writePersistedAssignmentDraft,
  writePersistedAuthoringSelection,
  writePersistedLessonDraft,
  type PersistedAssignmentDraft,
  type PersistedAuthoringSelection,
  type PersistedLessonDraft
} from "@/lib/admin/authoring-session"
import { extractAuthoringImportCandidate } from "@/lib/admin/catalog-import"
import { normalizeCodeChallengeLanguage } from "@/lib/challenges/model"
import {
  createDefaultMultipleChoiceOptions,
  ensureMultipleChoiceOptionShape,
  normalizeMultipleChoiceOptions
} from "@/lib/challenges/multiple-choice"
import {
  getEffectiveAssignmentReading,
  getEffectiveAssignmentReadingLabel,
  getChapterGuideReading
} from "@/lib/content/reading"
import {
  getDefaultJudge0LanguageId,
  getHiddenTestTemplate,
  getSolutionTemplate,
  getStarterTemplate
} from "@/lib/judge0/languages"
import { buildDefaultLocalLabCommandTemplate, buildDefaultLocalLabManifestSource } from "@/lib/local-labs"
import type {
  Challenge,
  ChallengeKind,
  CodeChallengeLanguage,
  ContentSnapshot,
  Lesson,
  MultipleChoiceOption
} from "@/lib/types"
import { slugify } from "@/lib/utils"

const NEW_COURSE = "__new_course__"
const NEW_CHAPTER = "__new_chapter__"
const NEW_ASSIGNMENT = "__new_assignment__"

const initialState: AuthoringActionState = {
  success: false,
  message: ""
}

type SelectOption = {
  value: string
  label: string
}

type AuthoringFormControllerProps = {
  snapshot: ContentSnapshot
  initialSelection?: PersistedAuthoringSelection | null
}

type AssignmentStateSetters = {
  setChallengeKind: (value: ChallengeKind) => void
  setLanguage: (value: CodeChallengeLanguage) => void
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

type LessonStateSetters = {
  setCourseTitle: (value: string) => void
  setLessonTitle: (value: string) => void
  setBodyMdx: (value: string) => void
}

type ResolvedAuthoringTarget = {
  course: ContentSnapshot["courses"][number] | null
  lesson: Lesson | null
  assignment: Challenge | null
}

type HiddenField = {
  name: string
  value: string
}

export type AuthoringFormController = {
  formAction: (payload: FormData) => void
  pending: boolean
  hiddenFields: HiddenField[]
  submitFeedback: { message: string; success: boolean } | null
  courseSection: {
    options: SelectOption[]
    selection: string
    courseTitle: string
    resolvedCourseSlug: string
    onSelectionChange: (value: string) => void
    onCourseTitleChange: (value: string) => void
  }
  chapterSection: {
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
  assignmentSection: {
    selection: {
      value: string
      options: SelectOption[]
      publicationStateLabel: string
      onChange: (value: string) => void
    }
    reading: {
      preview: string
      previewLabel: string
      hasChapterGuide: boolean
      assignmentReadingMdx: string
      promptMdx: string
      onAssignmentReadingChange: (value: string) => void
      onClearAssignmentReading: () => void
      onPromptMdxChange: (value: string) => void
    }
    kind: {
      value: ChallengeKind
      onChange: (value: ChallengeKind) => void
    }
    codeAssignment: {
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
    localLabAssignment: {
      submitCommandTemplate: string
      solutionNotes: string
      manifestSource: string
      onSubmitCommandTemplateChange: (value: string) => void
      onSolutionNotesChange: (value: string) => void
      onManifestSourceChange: (value: string) => void
    }
    multipleChoiceAssignment: {
      options: MultipleChoiceOption[]
      correctChoiceKey: string
      explanationMdx: string
      onOptionsChange: (options: MultipleChoiceOption[]) => void
      onCorrectChoiceKeyChange: (key: string) => void
      onExplanationChange: (value: string) => void
    }
  }
  authoringImport: {
    courseTitle: string
    lessonTitle: string
    assignmentLabel: string
    onApplyImport: (source: string) => { success: boolean; message: string }
  }
}

function getAssignmentLabel(challenge: Challenge, index: number) {
  const normalizedTitle = challenge.title.replace(/^assignment[:\s-]*/i, "").trim()
  const safeTitle = normalizedTitle || `Assignment ${index + 1}`
  const shortTitle = safeTitle.length > 34 ? `${safeTitle.slice(0, 31).trimEnd()}...` : safeTitle
  return `A${index + 1}: ${shortTitle}`
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

function buildPersistedLessonDraft(draft: PersistedLessonDraft): PersistedLessonDraft {
  return {
    courseTitle: draft.courseTitle,
    lessonTitle: draft.lessonTitle,
    bodyMdx: draft.bodyMdx
  }
}

function createEmptyAssignmentDraft(
  challengeKind: ChallengeKind,
  preferredLanguage: CodeChallengeLanguage
): PersistedAssignmentDraft {
  const defaultChoiceOptions = createDefaultMultipleChoiceOptions()
  const baseDraft = {
    challengeKind,
    language: preferredLanguage,
    judge0LanguageId: String(getDefaultJudge0LanguageId(preferredLanguage)),
    readingMdx: "",
    promptMdx: "",
    choiceOptions: defaultChoiceOptions,
    correctChoiceKey: defaultChoiceOptions[0]?.key ?? "",
    choiceExplanationMdx: ""
  }

  if (challengeKind === "multiple_choice") {
    return {
      ...baseDraft,
      starterCode: "",
      solutionCode: "",
      hiddenTestCode: ""
    }
  }

  if (challengeKind === "local_lab") {
    return {
      ...baseDraft,
      starterCode: buildDefaultLocalLabCommandTemplate(),
      solutionCode: "",
      hiddenTestCode: buildDefaultLocalLabManifestSource()
    }
  }

  return {
    ...baseDraft,
    starterCode: getStarterTemplate(preferredLanguage),
    solutionCode: getSolutionTemplate(preferredLanguage),
    hiddenTestCode: getHiddenTestTemplate(preferredLanguage)
  }
}

function buildChallengeDraft(challenge: Challenge): PersistedAssignmentDraft {
  const choiceOptions = ensureMultipleChoiceOptionShape(challenge.choiceOptions)

  return {
    challengeKind: challenge.kind,
    language: challenge.language ?? "javascript",
    judge0LanguageId: String(challenge.judge0LanguageId ?? getDefaultJudge0LanguageId("javascript")),
    readingMdx: challenge.readingMdx,
    promptMdx: challenge.promptMdx,
    starterCode: challenge.starterCode,
    solutionCode: challenge.solutionCode,
    hiddenTestCode: challenge.hiddenTestCode,
    choiceOptions,
    correctChoiceKey: challenge.kind === "multiple_choice" ? challenge.correctChoiceKey ?? choiceOptions[0]?.key ?? "" : "",
    choiceExplanationMdx: challenge.choiceExplanationMdx
  }
}

function applyPersistedLessonDraft(draft: PersistedLessonDraft, setters: LessonStateSetters) {
  setters.setCourseTitle(draft.courseTitle)
  setters.setLessonTitle(draft.lessonTitle)
  setters.setBodyMdx(draft.bodyMdx)
}

function applyPersistedAssignmentDraft(draft: PersistedAssignmentDraft, setters: AssignmentStateSetters) {
  setters.setChallengeKind(draft.challengeKind)
  setters.setLanguage(normalizeCodeChallengeLanguage(draft.language))
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
 * Hides selection restoration, draft persistence, and challenge-kind resets
 * behind one controller so the rendered form only deals with course, chapter,
 * and assignment sections.
 */
export function useAuthoringFormController({
  snapshot,
  initialSelection = null
}: AuthoringFormControllerProps): AuthoringFormController {
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
  const [language, setLanguage] = useState<CodeChallengeLanguage>(initialAssignment?.language ?? "javascript")
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

  const resolvedCourseSlug = selectedCourse?.slug ?? slugify(courseTitle)
  const resolvedLessonSlug = selectedLesson?.slug ?? slugify(lessonTitle)

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
  const chapterGuidePreview = useMemo(
    () =>
      getChapterGuideReading({
        lessonBodyMdx: bodyMdx,
        challengeReadingMdx: readingMdx,
        challengePromptMdx: promptMdx
      }),
    [bodyMdx, promptMdx, readingMdx]
  )

  const courseOptions = useMemo<SelectOption[]>(
    () => [
      ...snapshot.courses.map((course, index) => ({
        value: course.slug,
        label: `L${index + 1}: ${course.title}`
      })),
      {
        value: NEW_COURSE,
        label: "Create new course"
      }
    ],
    [snapshot.courses]
  )

  const chapterOptions = useMemo<SelectOption[]>(
    () => [
      ...courseLessons.map((lesson, index) => ({
        value: lesson.slug,
        label: `CH${index + 1}: ${lesson.title}`
      })),
      {
        value: NEW_CHAPTER,
        label: "Create new chapter"
      }
    ],
    [courseLessons]
  )

  const assignmentOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: NEW_ASSIGNMENT,
        label: "Create new assignment"
      },
      ...chapterAssignments.map((challenge, index) => ({
        value: challenge.slug,
        label: getAssignmentLabel(challenge, index)
      }))
    ],
    [chapterAssignments]
  )

  const assignmentStateSetters = useMemo<AssignmentStateSetters>(
    () => ({
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
    }),
    []
  )

  const lessonStateSetters = useMemo<LessonStateSetters>(
    () => ({
      setCourseTitle,
      setLessonTitle,
      setBodyMdx
    }),
    []
  )

  const applyStoredLessonDraft = useCallback((draft: PersistedLessonDraft) => {
    applyPersistedLessonDraft(draft, lessonStateSetters)
  }, [lessonStateSetters])

  const applyStoredAssignmentDraft = useCallback((draft: PersistedAssignmentDraft) => {
    applyPersistedAssignmentDraft(draft, assignmentStateSetters)
  }, [assignmentStateSetters])

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

  const applyChallengeDraft = useCallback((challenge: Challenge) => {
    applyStoredAssignmentDraft(buildChallengeDraft(challenge))
  }, [applyStoredAssignmentDraft])

  const resetAssignmentDraft = useCallback((nextKind: ChallengeKind, nextLanguage: CodeChallengeLanguage) => {
    applyStoredAssignmentDraft(createEmptyAssignmentDraft(nextKind, nextLanguage))
  }, [applyStoredAssignmentDraft])

  const openExistingAssignment = useCallback(
    (challenge: Challenge, selectionOverride?: PersistedAuthoringSelection | null) => {
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

      applyChallengeDraft(challenge)
    },
    [
      applyChallengeDraft,
      buildSelection,
      courseTitle,
      loadPersistedAssignmentDraftForSelection,
      loadPersistedLessonDraftForSelection,
      rememberSelection,
      selectedCourse?.title,
      selectedLesson
    ]
  )

  const openNewAssignmentDraft = useCallback(
    (selectionOverride?: PersistedAuthoringSelection | null) => {
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

      resetAssignmentDraft(challengeKind, language)
    },
    [
      buildSelection,
      challengeKind,
      courseTitle,
      language,
      loadPersistedAssignmentDraftForSelection,
      loadPersistedLessonDraftForSelection,
      rememberSelection,
      resetAssignmentDraft,
      selectedCourse?.title,
      selectedLesson
    ]
  )

  const handleChallengeKindChange = useCallback((nextKind: ChallengeKind) => {
    const nextLanguage = nextKind === "code" ? language : "javascript"
    resetAssignmentDraft(nextKind, nextLanguage)
  }, [language, resetAssignmentDraft])

  const handleCodeLanguageChange = useCallback((nextLanguage: CodeChallengeLanguage) => {
    setLanguage(nextLanguage)
    setJudge0LanguageId(String(getDefaultJudge0LanguageId(nextLanguage)))
    setStarterCode(getStarterTemplate(nextLanguage))
    setSolutionCode(getSolutionTemplate(nextLanguage))
    setHiddenTestCode(getHiddenTestTemplate(nextLanguage))
  }, [])

  const handleAssignmentSelectionChange = useCallback((nextAssignment: string) => {
    if (nextAssignment === NEW_ASSIGNMENT) {
      openNewAssignmentDraft()
      return
    }

    const nextSelectedAssignment = chapterAssignments.find((challenge) => challenge.slug === nextAssignment) ?? null
    if (nextSelectedAssignment) {
      openExistingAssignment(nextSelectedAssignment)
    }
  }, [chapterAssignments, openExistingAssignment, openNewAssignmentDraft])

  const applyImportedAssignmentToEditor = useCallback(
    (source: string) => {
      try {
        const candidate = extractAuthoringImportCandidate(source)
        const nextChallenge = candidate.challenge

        if (courseSelection === NEW_COURSE && candidate.course.title.trim()) {
          setCourseTitle(candidate.course.title.trim())
        }

        if (lessonSelection === NEW_CHAPTER && candidate.lesson.title.trim()) {
          setLessonTitle(candidate.lesson.title.trim())
        }

        if (candidate.lesson.bodyMdx) {
          setBodyMdx(candidate.lesson.bodyMdx)
        }

        setReadingMdx(nextChallenge.readingMdx ?? "")
        setPromptMdx(nextChallenge.promptMdx)

        if (nextChallenge.kind === "code") {
          const nextLanguage = normalizeCodeChallengeLanguage(nextChallenge.language ?? language)
          const defaultChoiceOptions = createDefaultMultipleChoiceOptions()

          setChallengeKind("code")
          setLanguage(nextLanguage)
          setJudge0LanguageId(String(nextChallenge.judge0LanguageId ?? getDefaultJudge0LanguageId(nextLanguage)))
          setStarterCode(nextChallenge.starterCode ?? getStarterTemplate(nextLanguage))
          setSolutionCode(nextChallenge.solutionCode ?? getSolutionTemplate(nextLanguage))
          setHiddenTestCode(nextChallenge.hiddenTestCode ?? getHiddenTestTemplate(nextLanguage))
          setChoiceOptions(defaultChoiceOptions)
          setCorrectChoiceKey(defaultChoiceOptions[0]?.key ?? "")
          setChoiceExplanationMdx("")
        } else if (nextChallenge.kind === "multiple_choice") {
          const nextChoiceOptions = normalizeMultipleChoiceOptions(nextChallenge.choiceOptions ?? [])
            .map((option) => ({
              ...option,
              label: option.label.trim()
            }))
            .filter((option) => option.label.length > 0)
          const safeChoiceOptions =
            nextChoiceOptions.length >= 2 ? nextChoiceOptions : createDefaultMultipleChoiceOptions()
          const safeCorrectChoiceKey = safeChoiceOptions.some((option) => option.key === nextChallenge.correctChoiceKey)
            ? nextChallenge.correctChoiceKey ?? safeChoiceOptions[0]?.key ?? ""
            : safeChoiceOptions[0]?.key ?? ""

          setChallengeKind("multiple_choice")
          setLanguage("javascript")
          setJudge0LanguageId(String(getDefaultJudge0LanguageId("javascript")))
          setStarterCode("")
          setSolutionCode("")
          setHiddenTestCode("")
          setChoiceOptions(safeChoiceOptions)
          setCorrectChoiceKey(safeCorrectChoiceKey)
          setChoiceExplanationMdx(nextChallenge.choiceExplanationMdx ?? "")
        } else {
          setChallengeKind("local_lab")
          setLanguage("javascript")
          setJudge0LanguageId(String(getDefaultJudge0LanguageId("javascript")))
          setStarterCode(nextChallenge.starterCode ?? buildDefaultLocalLabCommandTemplate())
          setSolutionCode(nextChallenge.solutionCode ?? "")
          setHiddenTestCode(nextChallenge.hiddenTestCode ?? buildDefaultLocalLabManifestSource())
          const defaultChoiceOptions = createDefaultMultipleChoiceOptions()
          setChoiceOptions(defaultChoiceOptions)
          setCorrectChoiceKey(defaultChoiceOptions[0]?.key ?? "")
          setChoiceExplanationMdx("")
        }

        const ignoredParts: string[] = []
        if (candidate.ignoredLessonCount > 0) {
          ignoredParts.push(
            candidate.ignoredLessonCount === 1
              ? "1 extra chapter was ignored"
              : `${candidate.ignoredLessonCount} extra chapters were ignored`
          )
        }
        if (candidate.ignoredChallengeCount > 0) {
          ignoredParts.push(
            candidate.ignoredChallengeCount === 1
              ? "1 extra assignment was ignored"
              : `${candidate.ignoredChallengeCount} extra assignments were ignored`
          )
        }

        return {
          success: true,
          message: ignoredParts.length
            ? `Imported into the editor. ${ignoredParts.join(", ")} because quick import only loads the first chapter and first assignment.`
            : "Imported into the editor. Review the fields below, then save or publish."
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Unable to parse this import content."
        }
      }
    },
    [courseSelection, language, lessonSelection]
  )

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
    const nextLesson = courseLessons.find((lesson) => lesson.slug === lessonSelection) ?? courseLessons[0] ?? null
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

    const currentAssignment = chapterAssignments.find((challenge) => challenge.slug === assignmentSelection) ?? null
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
    const storedAssignment = storedAssignments.find((challenge) => challenge.slug === storedSelection.challengeSlug) ?? null

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

    writePersistedAssignmentDraft(buildPersistedAssignmentDraftKey(currentDraftSelection), {
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

  const hiddenFields = useMemo<HiddenField[]>(
    () => [
      { name: "courseTitle", value: courseTitle },
      { name: "courseSlug", value: resolvedCourseSlug },
      { name: "lessonTitle", value: lessonTitle },
      { name: "lessonSlug", value: resolvedLessonSlug },
      { name: "challengeSlug", value: assignmentSelection === NEW_ASSIGNMENT ? "" : assignmentSelection },
      { name: "kind", value: challengeKind },
      { name: "choiceOptionsJson", value: JSON.stringify(choiceOptions) },
      { name: "choiceCorrectKey", value: correctChoiceKey },
      { name: "choiceExplanationMdx", value: choiceExplanationMdx }
    ],
    [
      assignmentSelection,
      challengeKind,
      choiceExplanationMdx,
      choiceOptions,
      correctChoiceKey,
      courseTitle,
      lessonTitle,
      resolvedCourseSlug,
      resolvedLessonSlug
    ]
  )

  return {
    formAction,
    pending,
    hiddenFields,
    submitFeedback: state.message
      ? {
          message: state.message,
          success: state.success
        }
      : null,
    courseSection: {
      options: courseOptions,
      selection: courseSelection,
      courseTitle,
      resolvedCourseSlug,
      onSelectionChange: setCourseSelection,
      onCourseTitleChange: setCourseTitle
    },
    chapterSection: {
      options: chapterOptions,
      selection: lessonSelection,
      lessonTitle,
      resolvedCourseSlug,
      resolvedLessonSlug,
      bodyMdx,
      onSelectionChange: setLessonSelection,
      onLessonTitleChange: setLessonTitle,
      onBodyMdxChange: setBodyMdx,
      onClearBodyMdx: () => setBodyMdx("")
    },
    assignmentSection: {
      selection: {
        value: assignmentSelection,
        options: assignmentOptions,
        publicationStateLabel: selectedAssignment ? selectedAssignment.publicationState.replace("_", " ") : "new draft",
        onChange: handleAssignmentSelectionChange
      },
      reading: {
        preview: learnerReadingPreview,
        previewLabel: learnerReadingLabel,
        hasChapterGuide: Boolean(chapterGuidePreview),
        assignmentReadingMdx: readingMdx,
        promptMdx,
        onAssignmentReadingChange: setReadingMdx,
        onClearAssignmentReading: () => setReadingMdx(""),
        onPromptMdxChange: setPromptMdx
      },
      kind: {
        value: challengeKind,
        onChange: handleChallengeKindChange
      },
      codeAssignment: {
        language,
        judge0LanguageId,
        starterCode,
        solutionCode,
        hiddenTestCode,
        onLanguageChange: handleCodeLanguageChange,
        onJudge0LanguageIdChange: setJudge0LanguageId,
        onStarterCodeChange: setStarterCode,
        onSolutionCodeChange: setSolutionCode,
        onHiddenTestCodeChange: setHiddenTestCode
      },
      localLabAssignment: {
        submitCommandTemplate: starterCode,
        solutionNotes: solutionCode,
        manifestSource: hiddenTestCode,
        onSubmitCommandTemplateChange: setStarterCode,
        onSolutionNotesChange: setSolutionCode,
        onManifestSourceChange: setHiddenTestCode
      },
      multipleChoiceAssignment: {
        options: choiceOptions,
        correctChoiceKey,
        explanationMdx: choiceExplanationMdx,
        onOptionsChange: setChoiceOptions,
        onCorrectChoiceKeyChange: setCorrectChoiceKey,
        onExplanationChange: setChoiceExplanationMdx
      }
    },
    authoringImport: {
      courseTitle: courseTitle || selectedCourse?.title || "Current course",
      lessonTitle: lessonTitle || selectedLesson?.title || "Current chapter",
      assignmentLabel:
        assignmentSelection === NEW_ASSIGNMENT
          ? "the new assignment draft"
          : selectedAssignment
            ? getAssignmentLabel(
                selectedAssignment,
                Math.max(0, chapterAssignments.findIndex((challenge) => challenge.id === selectedAssignment.id))
              )
            : "the selected assignment",
      onApplyImport: applyImportedAssignmentToEditor
    }
  }
}
