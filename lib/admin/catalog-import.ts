import { z } from "zod"

export type ImportedChallengeManifest = {
  kind: "code" | "multiple_choice" | "local_lab"
  title?: string
  slug?: string
  readingMdx?: string
  promptMdx: string
  language?: string | null
  judge0LanguageId?: number | null
  starterCode?: string
  solutionCode?: string
  hiddenTestCode?: string
  choiceOptions?: Array<{ key?: string; label: string }>
  correctChoiceKey?: string | null
  choiceExplanationMdx?: string
}

export type ImportedLessonManifest = {
  title: string
  slug?: string
  summary?: string
  estimatedMinutes?: number
  bodyMdx?: string
  challenges: ImportedChallengeManifest[]
}

export type ImportedCourseManifest = {
  title: string
  slug?: string
  summary?: string
  difficulty?: string
  accent?: string
  lessons: ImportedLessonManifest[]
}

const importedChallengeSchema = z.object({
  kind: z.enum(["code", "multiple_choice", "local_lab"]).default("code"),
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  readingMdx: z.string().optional(),
  promptMdx: z.string().min(1),
  language: z.string().optional().nullable(),
  judge0LanguageId: z.number().int().positive().optional().nullable(),
  starterCode: z.string().optional(),
  solutionCode: z.string().optional(),
  hiddenTestCode: z.string().optional(),
  choiceOptions: z.array(z.object({ key: z.string().optional(), label: z.string().min(1) })).optional(),
  correctChoiceKey: z.string().optional().nullable(),
  choiceExplanationMdx: z.string().optional()
})

const importedLessonSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  summary: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  bodyMdx: z.string().optional(),
  challenges: z.array(importedChallengeSchema).min(1)
})

const importedCourseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  summary: z.string().optional(),
  difficulty: z.string().optional(),
  accent: z.string().optional(),
  lessons: z.array(importedLessonSchema).min(1)
})

const importedCatalogSchema = z.union([
  z.object({ course: importedCourseSchema }),
  z.object({ courses: z.array(importedCourseSchema).min(1) })
])

const BLOCK_TERMINATOR = "<<<END"

export const BULK_IMPORT_OUTLINE_EXAMPLE = `COURSE: Learn JavaScript
SUMMARY:
A practical path into software with learn javascript.
<<<END
DIFFICULTY: Beginner
ACCENT: #c96f36

CHAPTER: Variables
SUMMARY:
Variables practice and assignments.
<<<END
MINUTES: 10
BODY:
# Learn JavaScript (for Developers)

What to Expect

\`\`\`javascript
const greeting = "hello";
console.log(greeting);
\`\`\`
<<<END

ASSIGNMENT: Print the expected text
KIND: code
LANGUAGE: javascript
READING:
Use \`console.log\` to print the exact expected message.
<<<END
PROMPT:
Print Starting Textio server... to the console.
<<<END
STARTER CODE:
console.log("hello there!");
<<<END
SOLUTION:
console.log("Starting Textio server...");
<<<END
HIDDEN TESTS:
if (!stackOutput.includes("Starting Textio server...")) {
  throw new Error("Print the expected text");
}
<<<END

ASSIGNMENT: In JavaScript, 5 is a ____ while 5.5 is a ____
KIND: multiple_choice
PROMPT:
Choose the correct answer.
<<<END
CHOICES:
[correct] Number, Number
Integer, Number
Integer, Float
Float, Integer
<<<END
EXPLANATION:
JavaScript uses one \`number\` type for both whole numbers and decimals.
<<<END`

type PlainTextFieldTarget =
  | "courseSummary"
  | "lessonSummary"
  | "lessonBody"
  | "challengeReading"
  | "challengePrompt"
  | "challengeStarterCode"
  | "challengeSolutionCode"
  | "challengeHiddenTests"
  | "challengeChoices"
  | "challengeExplanation"

type ParserState = {
  currentCourse: ImportedCourseManifest | null
  currentLesson: ImportedLessonManifest | null
  currentChallenge: ImportedChallengeManifest | null
  activeField: PlainTextFieldTarget | null
  activeLines: string[]
}

function finishChallenge(state: ParserState) {
  if (!state.currentChallenge) {
    return
  }

  if (!state.currentLesson) {
    throw new Error("Each ASSIGNMENT block must belong to a CHAPTER.")
  }

  state.currentLesson.challenges.push(state.currentChallenge)
  state.currentChallenge = null
}

function finishLesson(state: ParserState) {
  finishChallenge(state)

  if (!state.currentLesson) {
    return
  }

  if (!state.currentCourse) {
    throw new Error("Each CHAPTER block must belong to a COURSE.")
  }

  state.currentCourse.lessons.push(state.currentLesson)
  state.currentLesson = null
}

function finishCourse(state: ParserState, courses: ImportedCourseManifest[]) {
  finishLesson(state)

  if (!state.currentCourse) {
    return
  }

  courses.push(state.currentCourse)
  state.currentCourse = null
}

function normalizeInlineValue(value: string) {
  return value.replace(/^\s+|\s+$/g, "")
}

function parseChoicesBlock(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const choiceOptions: ImportedChallengeManifest["choiceOptions"] = []
  let correctChoiceKey: string | null = null

  lines.forEach((line, index) => {
    const normalizedLine = line.replace(/^[-*]\s*/, "")
    const isCorrect = /^\[(?:x|correct)\]\s*/i.test(normalizedLine)
    const label = normalizedLine.replace(/^\[(?:x|correct)\]\s*/i, "").trim()
    const key = `choice_${index + 1}`

    choiceOptions?.push({
      key,
      label
    })

    if (isCorrect && !correctChoiceKey) {
      correctChoiceKey = key
    }
  })

  if (!choiceOptions?.length) {
    return {
      choiceOptions: [],
      correctChoiceKey: null
    }
  }

  return {
    choiceOptions,
    correctChoiceKey: correctChoiceKey ?? choiceOptions[0]?.key ?? null
  }
}

function applyFieldValue(state: ParserState, target: PlainTextFieldTarget, value: string) {
  const trimmedValue = value.replace(/\s+$/g, "")

  switch (target) {
    case "courseSummary":
      if (!state.currentCourse) {
        throw new Error("COURSE SUMMARY needs a COURSE first.")
      }
      state.currentCourse.summary = trimmedValue
      return
    case "lessonSummary":
      if (!state.currentLesson) {
        throw new Error("CHAPTER SUMMARY needs a CHAPTER first.")
      }
      state.currentLesson.summary = trimmedValue
      return
    case "lessonBody":
      if (!state.currentLesson) {
        throw new Error("BODY needs a CHAPTER first.")
      }
      state.currentLesson.bodyMdx = trimmedValue
      return
    case "challengeReading":
      if (!state.currentChallenge) {
        throw new Error("READING needs an ASSIGNMENT first.")
      }
      state.currentChallenge.readingMdx = trimmedValue
      return
    case "challengePrompt":
      if (!state.currentChallenge) {
        throw new Error("PROMPT needs an ASSIGNMENT first.")
      }
      state.currentChallenge.promptMdx = trimmedValue
      return
    case "challengeStarterCode":
      if (!state.currentChallenge) {
        throw new Error("STARTER CODE needs an ASSIGNMENT first.")
      }
      state.currentChallenge.starterCode = trimmedValue
      return
    case "challengeSolutionCode":
      if (!state.currentChallenge) {
        throw new Error("SOLUTION needs an ASSIGNMENT first.")
      }
      state.currentChallenge.solutionCode = trimmedValue
      return
    case "challengeHiddenTests":
      if (!state.currentChallenge) {
        throw new Error("HIDDEN TESTS needs an ASSIGNMENT first.")
      }
      state.currentChallenge.hiddenTestCode = trimmedValue
      return
    case "challengeChoices":
      if (!state.currentChallenge) {
        throw new Error("CHOICES need an ASSIGNMENT first.")
      }
      Object.assign(state.currentChallenge, parseChoicesBlock(trimmedValue))
      return
    case "challengeExplanation":
      if (!state.currentChallenge) {
        throw new Error("EXPLANATION needs an ASSIGNMENT first.")
      }
      state.currentChallenge.choiceExplanationMdx = trimmedValue
      return
  }
}

function finishActiveField(state: ParserState) {
  if (!state.activeField) {
    return
  }

  applyFieldValue(state, state.activeField, state.activeLines.join("\n"))
  state.activeField = null
  state.activeLines = []
}

function startBlockField(state: ParserState, target: PlainTextFieldTarget, inlineValue: string) {
  if (inlineValue) {
    applyFieldValue(state, target, inlineValue)
    return
  }

  state.activeField = target
  state.activeLines = []
}

function getFieldTarget(label: string, state: ParserState): PlainTextFieldTarget | null {
  const normalizedLabel = label.trim().toUpperCase()

  switch (normalizedLabel) {
    case "SUMMARY":
      if (state.currentChallenge) {
        return null
      }

      return state.currentLesson ? "lessonSummary" : "courseSummary"
    case "BODY":
    case "BODY MDX":
    case "CHAPTER GUIDE":
      return "lessonBody"
    case "READING":
      return "challengeReading"
    case "PROMPT":
    case "PROMPT MDX":
      return "challengePrompt"
    case "STARTER":
    case "STARTER CODE":
      return "challengeStarterCode"
    case "SOLUTION":
    case "SOLUTION CODE":
    case "ANSWER":
      return "challengeSolutionCode"
    case "TESTS":
    case "HIDDEN TESTS":
    case "CHECKER":
      return "challengeHiddenTests"
    case "CHOICES":
    case "ANSWER CHOICES":
      return "challengeChoices"
    case "EXPLANATION":
    case "ANSWER EXPLANATION":
      return "challengeExplanation"
    default:
      return null
  }
}

function assignScalarField(label: string, inlineValue: string, state: ParserState) {
  const normalizedLabel = label.trim().toUpperCase()
  const value = normalizeInlineValue(inlineValue)

  switch (normalizedLabel) {
    case "DIFFICULTY":
      if (!state.currentCourse) {
        throw new Error("DIFFICULTY needs a COURSE first.")
      }
      state.currentCourse.difficulty = value
      return true
    case "ACCENT":
      if (!state.currentCourse) {
        throw new Error("ACCENT needs a COURSE first.")
      }
      state.currentCourse.accent = value
      return true
    case "MINUTES":
    case "ESTIMATED MINUTES":
      if (!state.currentLesson) {
        throw new Error("MINUTES needs a CHAPTER first.")
      }
      state.currentLesson.estimatedMinutes = Number(value)
      return true
    case "KIND":
    case "TYPE":
      if (!state.currentChallenge) {
        throw new Error("KIND needs an ASSIGNMENT first.")
      }
      state.currentChallenge.kind = value.toLowerCase() as ImportedChallengeManifest["kind"]
      return true
    case "LANGUAGE":
    case "ANSWER LANGUAGE":
      if (!state.currentChallenge) {
        throw new Error("LANGUAGE needs an ASSIGNMENT first.")
      }
      state.currentChallenge.language = value || null
      return true
    case "CHECKER LANGUAGE ID":
      if (!state.currentChallenge) {
        throw new Error("CHECKER LANGUAGE ID needs an ASSIGNMENT first.")
      }
      state.currentChallenge.judge0LanguageId = Number(value)
      return true
    case "SLUG":
      if (state.currentChallenge) {
        state.currentChallenge.slug = value
        return true
      }

      if (state.currentLesson) {
        state.currentLesson.slug = value
        return true
      }

      if (!state.currentCourse) {
        throw new Error("SLUG needs a COURSE, CHAPTER, or ASSIGNMENT first.")
      }

      state.currentCourse.slug = value
      return true
    default:
      return false
  }
}

function parseStructuredCatalogOutline(source: string) {
  const lines = source.split(/\r?\n/)
  const state: ParserState = {
    currentCourse: null,
    currentLesson: null,
    currentChallenge: null,
    activeField: null,
    activeLines: []
  }
  const courses: ImportedCourseManifest[] = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "")

    if (state.activeField) {
      if (line.trim() === BLOCK_TERMINATOR) {
        finishActiveField(state)
        continue
      }

      state.activeLines.push(line)
      continue
    }

    const trimmedLine = line.trim()
    if (!trimmedLine) {
      continue
    }

    const sectionMatch = trimmedLine.match(/^(COURSE|CHAPTER|LESSON|ASSIGNMENT|CHALLENGE):\s*(.+)$/i)
    if (sectionMatch) {
      const sectionType = sectionMatch[1].toUpperCase()
      const title = normalizeInlineValue(sectionMatch[2])

      if (sectionType === "COURSE") {
        finishCourse(state, courses)
        state.currentCourse = {
          title,
          lessons: []
        }
        continue
      }

      if (sectionType === "CHAPTER" || sectionType === "LESSON") {
        finishLesson(state)

        if (!state.currentCourse) {
          throw new Error("Start the outline with a COURSE before adding CHAPTER sections.")
        }

        state.currentLesson = {
          title,
          challenges: []
        }
        continue
      }

      finishChallenge(state)

      if (!state.currentLesson) {
        throw new Error("Start an ASSIGNMENT only after a CHAPTER section.")
      }

      state.currentChallenge = {
        title,
        kind: "code",
        promptMdx: ""
      }
      continue
    }

    const fieldMatch = line.match(/^([A-Za-z][A-Za-z _-]*):\s*(.*)$/)
    if (!fieldMatch) {
      throw new Error(`Could not parse line: ${line}`)
    }

    const [, rawLabel, rawValue] = fieldMatch
    const fieldTarget = getFieldTarget(rawLabel, state)

    if (fieldTarget) {
      startBlockField(state, fieldTarget, rawValue)
      continue
    }

    if (!assignScalarField(rawLabel, rawValue, state)) {
      throw new Error(`Unknown field label: ${rawLabel}`)
    }
  }

  finishActiveField(state)
  finishCourse(state, courses)

  return courses
}

function normalizeImportedCoursesFromJson(source: string) {
  const parsed = JSON.parse(source) as unknown
  const normalized = importedCatalogSchema.parse(parsed)
  return "course" in normalized ? [normalized.course] : normalized.courses
}

function normalizeImportedCoursesFromOutline(source: string) {
  return z.array(importedCourseSchema).min(1).parse(parseStructuredCatalogOutline(source))
}

/**
 * Accepts either the structured JSON manifest or a faster bulk-authoring
 * outline so authors can paste large course batches without hand-building UI
 * forms for every assignment.
 */
export function parseCatalogImportSource(source: string) {
  const trimmedSource = source.trim()

  if (!trimmedSource) {
    throw new Error("Paste a JSON manifest or a bulk-authoring outline first.")
  }

  try {
    return normalizeImportedCoursesFromJson(trimmedSource)
  } catch (jsonError) {
    try {
      return normalizeImportedCoursesFromOutline(trimmedSource)
    } catch (outlineError) {
      if (outlineError instanceof z.ZodError) {
        throw new Error(outlineError.issues[0]?.message ?? "Import content could not be parsed.")
      }

      if (outlineError instanceof Error) {
        throw outlineError
      }

      if (jsonError instanceof z.ZodError) {
        throw new Error(jsonError.issues[0]?.message ?? "Import content could not be parsed.")
      }

      throw new Error("Import content could not be parsed.")
    }
  }
}
