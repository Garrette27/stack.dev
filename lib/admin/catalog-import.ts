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

export const BULK_IMPORT_AI_PROMPT_TEMPLATE = `Format the source material below into the Stack.dev bulk import outline.

Return only the formatted outline.
Do not explain anything before or after it.

Rules:
- Use this structure: COURSE, SUMMARY, DIFFICULTY, ACCENT, CHAPTER, MINUTES, BODY, ASSIGNMENT, KIND, LANGUAGE, READING, PROMPT, STARTER CODE, SOLUTION, HIDDEN TESTS, CHOICES, EXPLANATION.
- End every multiline field with <<<END.
- Preserve Markdown and fenced code blocks when the source includes reading content or code examples.
- When a code example appears in BODY, READING, PROMPT, or EXPLANATION, return literal triple-backtick fences in the text output instead of a rendered rich-text code block.
- Add blank lines between paragraphs and fenced code blocks so the learner reading renders cleanly.
- Wrap code examples in fenced code blocks whenever they appear inside BODY, READING, PROMPT, or EXPLANATION.
- Use KIND: code for coding assignments.
- Use KIND: multiple_choice for quiz assignments.
- If the source shows answer choices or numbered options and does not include starter/solution code, prefer KIND: multiple_choice.
- If the source includes starter code, solution code, checker behavior, or an editable code block, prefer KIND: code.
- Keep assignment instructions in PROMPT and assignment-specific supporting text in READING.
- Keep editable learner code only in STARTER CODE, corrected code only in SOLUTION, and checker logic only in HIDDEN TESTS unless the source is explicitly teaching those snippets in BODY.
- If a code assignment includes starter code and solution but no checker, generate HIDDEN TESTS from the expected learner-visible behavior or output.
- Keep generated hidden tests deterministic and avoid brittle implementation checks when an output check is enough.
- For multiple choice, list one correct answer as [correct] inside CHOICES.
- If author notes specify the correct multiple-choice answer, use that note to mark the [correct] choice.
- If the source asks for a multiple-choice version, generate CHOICES and mark one [correct].
- If the source does not include a field, omit it instead of inventing content.
- Keep code exactly as provided unless the source clearly includes a corrected solution or checker.
- If a language is clear, include LANGUAGE.
- Remove copied UI noise like editor line numbers, buttons, or stray OCR fragments when they are clearly not part of the lesson.
- If the source contains one chapter only, still include COURSE and CHAPTER blocks.

Use this output style:
${BULK_IMPORT_OUTLINE_EXAMPLE}

Source material:
[PASTE SOURCE HERE]`

export type BulkImportPromptDestination = "new_course" | "existing_course" | "existing_lesson"

export type AuthoringImportCandidate = {
  course: ImportedCourseManifest
  lesson: ImportedLessonManifest
  challenge: ImportedChallengeManifest
  ignoredLessonCount: number
  ignoredChallengeCount: number
}

/**
 * Builds a copy-paste prompt for external formatting tools so authors can
 * normalize messy curriculum source into the import outline without learning
 * the whole manifest shape by hand.
 */
export function buildBulkImportAiPrompt(options: {
  destinationScope: BulkImportPromptDestination
  targetCourseTitle?: string | null
  targetLessonTitle?: string | null
  authorNotes?: string | null
}) {
  const destinationGuidance =
    options.destinationScope === "existing_lesson" && options.targetCourseTitle && options.targetLessonTitle
      ? [
          `This import will append assignments into the existing Stack.dev course "${options.targetCourseTitle}" and chapter "${options.targetLessonTitle}".`,
          `Keep COURSE: ${options.targetCourseTitle}.`,
          `Keep CHAPTER: ${options.targetLessonTitle}.`,
          "Put reusable lesson explanation in BODY.",
          "Put assignment-specific instructions in READING and PROMPT.",
          "If starter code and solution are present but tests are missing, generate HIDDEN TESTS from the expected learner-visible behavior.",
          "If the source is being converted into a quiz, generate CHOICES and mark one [correct].",
          "Do not invent a new course or a new chapter for this import."
        ]
      : options.destinationScope === "existing_course" && options.targetCourseTitle
        ? [
            `This import will append new chapters into the existing Stack.dev course "${options.targetCourseTitle}".`,
            `Keep COURSE: ${options.targetCourseTitle}.`,
            "Use CHAPTER blocks for each imported chapter.",
            "Do not invent a different course title for this import."
          ]
        : [
            "This import will create new course content, so include COURSE and CHAPTER blocks in the outline."
          ]

  return `Format the source material below into the Stack.dev bulk import outline.

Return only the formatted outline.
Do not explain anything before or after it.

Rules:
- Use this structure: COURSE, SUMMARY, DIFFICULTY, ACCENT, CHAPTER, MINUTES, BODY, ASSIGNMENT, KIND, LANGUAGE, READING, PROMPT, STARTER CODE, SOLUTION, HIDDEN TESTS, CHOICES, EXPLANATION.
- End every multiline field with <<<END.
- Preserve Markdown and fenced code blocks when the source includes reading content or code examples.
- When a code example appears in BODY, READING, PROMPT, or EXPLANATION, return literal triple-backtick fences in the text output instead of a rendered rich-text code block.
- Add blank lines between paragraphs and fenced code blocks so the learner reading renders cleanly.
- Wrap code examples in fenced code blocks whenever they appear inside BODY, READING, PROMPT, or EXPLANATION.
- Use KIND: code for coding assignments.
- Use KIND: multiple_choice for quiz assignments.
- If the source shows answer choices or numbered options and does not include starter/solution code, prefer KIND: multiple_choice.
- If the source includes starter code, solution code, checker behavior, or an editable code block, prefer KIND: code.
- Keep assignment instructions in PROMPT and assignment-specific supporting text in READING.
- Keep editable learner code only in STARTER CODE, corrected code only in SOLUTION, and checker logic only in HIDDEN TESTS unless the source is explicitly teaching those snippets in BODY.
- If a code assignment includes starter code and solution but no checker, generate HIDDEN TESTS from the expected learner-visible behavior or output.
- Keep generated hidden tests deterministic and avoid brittle implementation checks when an output check is enough.
- For multiple choice, list one correct answer as [correct] inside CHOICES.
- If author notes specify the correct multiple-choice answer, use that note to mark the [correct] choice.
- If the source asks for a multiple-choice version, generate CHOICES and mark one [correct].
- If the source does not include a field, omit it instead of inventing content.
- Keep code exactly as provided unless the source clearly includes a corrected solution or checker.
- If a language is clear, include LANGUAGE.
- Remove copied UI noise like editor line numbers, buttons, or stray OCR fragments when they are clearly not part of the lesson.
- If the source contains one chapter only, still include COURSE and CHAPTER blocks.

Destination guidance:
${destinationGuidance.map((line) => `- ${line}`).join("\n")}

${options.authorNotes?.trim()
  ? `Author notes:
${options.authorNotes
  .trim()
  .split(/\r?\n/)
  .map((line) => `- ${line.trim()}`)
  .join("\n")}

`
  : ""}Use this output style:
${BULK_IMPORT_OUTLINE_EXAMPLE}

Source material:
[PASTE SOURCE HERE]`
}

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
    case "TEST CASES":
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

function normalizeTextLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n")
}

function trimTrailingWhitespace(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
}

function stripStandaloneEditorLineNumbers(value: string) {
  const lines = value.split("\n")
  const nextLines: string[] = []
  let lineNumberRun: string[] = []

  function flushLineNumberRun() {
    if (lineNumberRun.length && lineNumberRun.length < 3) {
      nextLines.push(...lineNumberRun)
    }
    lineNumberRun = []
  }

  for (const line of lines) {
    if (/^\s*\d+\s*$/.test(line)) {
      lineNumberRun.push(line)
      continue
    }

    flushLineNumberRun()
    nextLines.push(line)
  }

  flushLineNumberRun()
  return nextLines.join("\n")
}

const CODE_FENCE_LANGUAGE_ALIASES: Record<string, string> = {
  bash: "bash",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  css: "css",
  go: "go",
  golang: "go",
  html: "html",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  mdx: "mdx",
  php: "php",
  py: "python",
  python: "python",
  ruby: "ruby",
  rs: "rust",
  rust: "rust",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml"
}

function normalizeFenceLanguageLabel(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, "")
  return CODE_FENCE_LANGUAGE_ALIASES[normalizedValue] ?? null
}

function findNextNonEmptyLineIndex(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index]?.trim()) {
      return index
    }
  }

  return -1
}

function looksLikeJavaScriptLine(line: string) {
  const trimmedLine = line.trim()
  if (!trimmedLine) {
    return false
  }

  return (
    /^(const|let|var)\s+/.test(trimmedLine) ||
    trimmedLine.startsWith("console.log(") ||
    trimmedLine.startsWith("//") ||
    trimmedLine === "{" ||
    trimmedLine === "}" ||
    /^if\s*\(/.test(trimmedLine) ||
    /^for\s*\(/.test(trimmedLine) ||
    /^while\s*\(/.test(trimmedLine) ||
    /^function\s+/.test(trimmedLine) ||
    /^return\b/.test(trimmedLine) ||
    /^import\s+/.test(trimmedLine) ||
    /^export\s+/.test(trimmedLine) ||
    trimmedLine.includes("=>")
  )
}

function looksLikeAssignmentStatement(line: string) {
  const trimmedLine = line.trim()
  return /^[A-Za-z_$][\w$.[\]]*\s*[-+*/%]?=\s*.+/.test(trimmedLine)
}

function looksLikeIncrementStatement(line: string) {
  const trimmedLine = line.trim()
  return (
    /^(?:\+\+|--)\s*[A-Za-z_$][\w$.[\]]*;?$/.test(trimmedLine) ||
    /^[A-Za-z_$][\w$.[\]]*\s*(?:\+\+|--);?$/.test(trimmedLine)
  )
}

function looksLikeCodeLine(line: string) {
  const trimmedLine = line.trim()
  if (!trimmedLine) {
    return false
  }

  if (trimmedLine.startsWith("```")) {
    return false
  }

  return (
    looksLikeJavaScriptLine(trimmedLine) ||
    looksLikeAssignmentStatement(trimmedLine) ||
    looksLikeIncrementStatement(trimmedLine) ||
    trimmedLine.startsWith("//") ||
    trimmedLine.startsWith("/*") ||
    trimmedLine.endsWith(";") ||
    /[{}]/.test(trimmedLine) ||
    trimmedLine.includes("console.log(") ||
    trimmedLine.includes("?.") ||
    trimmedLine.includes("=>")
  )
}

function pickCodeFenceLanguage(lines: string[], languageHint?: string | null) {
  if (languageHint?.trim()) {
    return normalizeFenceLanguageLabel(languageHint) ?? languageHint.trim().toLowerCase()
  }

  return lines.some(looksLikeJavaScriptLine) ? "javascript" : ""
}

/**
 * Rich-text copies from external AI tools sometimes collapse a code block into
 * one prose line. This reconstructs likely statement boundaries before the
 * generic fence pass decides whether the line should render as code.
 */
function splitLikelyInlineCodeParagraph(line: string) {
  const trimmedLine = line.trim()
  if (!trimmedLine || trimmedLine.startsWith("```")) {
    return null
  }

  const statementCueCount = (trimmedLine.match(/;/g) ?? []).length
  const hasCodeSignals =
    /(^|\s)(const|let|var|if|for|while|function|return)\b/.test(trimmedLine) ||
    looksLikeAssignmentStatement(trimmedLine) ||
    looksLikeIncrementStatement(trimmedLine) ||
    trimmedLine.includes("console.log(") ||
    trimmedLine.includes("=>")

  if (!hasCodeSignals || statementCueCount < 2) {
    return null
  }

  const normalizedLine = trimmedLine
    .replace(/;\s+(?=(?:const|let|var|if|for|while|function|return|console\.log|[A-Za-z_$][\w$]*(?:\+\+|--)))/g, ";\n")
    .replace(/(\+\+|--)\s+(?=(?:const|let|var|if|for|while|function|return|console\.log))/g, "$1\n")
    .replace(/(\/\/[^\n]*)\s+(?=(?:const|let|var|if|for|while|function|return|console\.log|[A-Za-z_$][\w$]*(?:\+\+|--)))/g, "$1\n")

  const splitLines = normalizedLine
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (splitLines.length < 2 || !splitLines.every(looksLikeCodeLine)) {
    return null
  }

  return splitLines
}

function extractLikelyCodeLines(line: string) {
  const inlineCodeLines = splitLikelyInlineCodeParagraph(line)
  if (inlineCodeLines) {
    return inlineCodeLines
  }

  return looksLikeCodeLine(line) ? [line] : null
}

function fenceLikelyCodeBlocks(value: string, languageHint?: string | null) {
  const lines = value.split("\n")
  const nextLines: string[] = []
  let index = 0
  let insideFence = false

  while (index < lines.length) {
    const line = lines[index]
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith("```")) {
      insideFence = !insideFence
      nextLines.push(line)
      index += 1
      continue
    }

    const explicitLanguage = normalizeFenceLanguageLabel(trimmedLine)
    if (!insideFence && explicitLanguage) {
      const nextNonEmptyIndex = findNextNonEmptyLineIndex(lines, index + 1)
      if (nextNonEmptyIndex !== -1 && extractLikelyCodeLines(lines[nextNonEmptyIndex] ?? "")) {
        const codeLines: string[] = []
        let lookahead = nextNonEmptyIndex

        while (lookahead < lines.length) {
          const candidate = lines[lookahead]
          const trimmedCandidate = candidate.trim()

          if (!trimmedCandidate) {
            const nextCandidateIndex = findNextNonEmptyLineIndex(lines, lookahead + 1)
            if (nextCandidateIndex === -1 || !extractLikelyCodeLines(lines[nextCandidateIndex] ?? "")) {
              break
            }

            codeLines.push(candidate)
            lookahead += 1
            continue
          }

          if (trimmedCandidate.startsWith("```")) {
            break
          }

          const candidateCodeLines = extractLikelyCodeLines(candidate)
          if (!candidateCodeLines) {
            break
          }

          codeLines.push(...candidateCodeLines)
          lookahead += 1
        }

        if (nextLines.length && nextLines[nextLines.length - 1]?.trim()) {
          nextLines.push("")
        }

        nextLines.push(`\`\`\`${explicitLanguage}`)
        nextLines.push(...codeLines)
        nextLines.push("```")

        if (lookahead < lines.length && lines[lookahead]?.trim()) {
          nextLines.push("")
        }

        index = lookahead
        continue
      }
    }

    const initialCodeLines = extractLikelyCodeLines(line)
    if (insideFence || !initialCodeLines) {
      nextLines.push(line)
      index += 1
      continue
    }

    const codeLines: string[] = [...initialCodeLines]
    let lookahead = index + 1

    while (lookahead < lines.length) {
      const candidate = lines[lookahead]
      const trimmedCandidate = candidate.trim()

      if (!trimmedCandidate) {
        const nextNonEmptyIndex = findNextNonEmptyLineIndex(lines, lookahead + 1)
        if (nextNonEmptyIndex === -1 || !extractLikelyCodeLines(lines[nextNonEmptyIndex] ?? "")) {
          break
        }

        codeLines.push(candidate)
        lookahead += 1
        continue
      }

      const candidateCodeLines = extractLikelyCodeLines(candidate)
      if (trimmedCandidate.startsWith("```") || !candidateCodeLines) {
        break
      }

      codeLines.push(...candidateCodeLines)
      lookahead += 1
    }

    const fenceLanguage = pickCodeFenceLanguage(codeLines, languageHint)
    if (nextLines.length && nextLines[nextLines.length - 1]?.trim()) {
      nextLines.push("")
    }

    nextLines.push(`\`\`\`${fenceLanguage}`)
    nextLines.push(...codeLines)
    nextLines.push("```")

    if (lookahead < lines.length && lines[lookahead]?.trim()) {
      nextLines.push("")
    }

    index = lookahead
  }

  return nextLines.join("\n")
}

function collapseExtraBlankLines(value: string) {
  return value.replace(/\n{3,}/g, "\n\n")
}

function normalizeImportedRichText(value: string, options?: { languageHint?: string | null }) {
  const normalizedValue = collapseExtraBlankLines(
    fenceLikelyCodeBlocks(
      stripStandaloneEditorLineNumbers(trimTrailingWhitespace(normalizeTextLineEndings(value))).trim(),
      options?.languageHint
    )
  )

  return normalizedValue
}

function normalizeImportedCode(value: string) {
  const normalizedCode = trimTrailingWhitespace(normalizeTextLineEndings(value))
  const strippedCode = stripStandaloneEditorLineNumbers(normalizedCode).trim()
  const inlineCodeLines = splitLikelyInlineCodeParagraph(strippedCode)

  return (inlineCodeLines ? inlineCodeLines.join("\n") : strippedCode).trim()
}

function stripDuplicatedCodeFence(value: string, duplicatedCode?: string) {
  if (!duplicatedCode?.trim()) {
    return value
  }

  const normalizedDuplicatedCode = normalizeImportedCode(duplicatedCode)
  const nextValue = value.replace(/```[\w-]*\n([\s\S]*?)```/g, (match, fencedCode: string) => {
    return normalizeImportedCode(fencedCode) === normalizedDuplicatedCode ? "" : match
  })

  return collapseExtraBlankLines(nextValue).trim()
}

function normalizeImportedChallenge(manifest: ImportedChallengeManifest): ImportedChallengeManifest {
  const languageHint = manifest.kind === "code" ? manifest.language ?? null : null
  const normalizedStarterCode = manifest.starterCode ? normalizeImportedCode(manifest.starterCode) : undefined
  const normalizedSolutionCode = manifest.solutionCode ? normalizeImportedCode(manifest.solutionCode) : undefined
  const normalizedHiddenTestCode = manifest.hiddenTestCode ? normalizeImportedCode(manifest.hiddenTestCode) : undefined
  const normalizedReadingMdx = manifest.readingMdx
    ? normalizeImportedRichText(manifest.readingMdx, { languageHint })
    : undefined
  const normalizedPromptMdx = normalizeImportedRichText(manifest.promptMdx, { languageHint })

  return {
    ...manifest,
    title: manifest.title?.trim() || undefined,
    slug: manifest.slug?.trim() || undefined,
    readingMdx: normalizedReadingMdx,
    promptMdx:
      manifest.kind === "code"
        ? stripDuplicatedCodeFence(
            stripDuplicatedCodeFence(normalizedPromptMdx, normalizedStarterCode),
            normalizedSolutionCode
          )
        : normalizedPromptMdx,
    starterCode: normalizedStarterCode,
    solutionCode: normalizedSolutionCode,
    hiddenTestCode: normalizedHiddenTestCode,
    choiceExplanationMdx: manifest.choiceExplanationMdx
      ? normalizeImportedRichText(manifest.choiceExplanationMdx, { languageHint })
      : undefined
  }
}

function normalizeImportedLesson(manifest: ImportedLessonManifest): ImportedLessonManifest {
  const languageHint =
    manifest.challenges.find((challenge) => challenge.kind === "code" && challenge.language)?.language ?? null

  return {
    ...manifest,
    title: manifest.title.trim(),
    slug: manifest.slug?.trim() || undefined,
    summary: manifest.summary?.trim() || undefined,
    bodyMdx: manifest.bodyMdx ? normalizeImportedRichText(manifest.bodyMdx, { languageHint }) : undefined,
    challenges: manifest.challenges.map(normalizeImportedChallenge)
  }
}

function normalizeImportedCourse(manifest: ImportedCourseManifest): ImportedCourseManifest {
  return {
    ...manifest,
    title: manifest.title.trim(),
    slug: manifest.slug?.trim() || undefined,
    summary: manifest.summary?.trim() || undefined,
    difficulty: manifest.difficulty?.trim() || undefined,
    accent: manifest.accent?.trim() || undefined,
    lessons: manifest.lessons.map(normalizeImportedLesson)
  }
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
    return normalizeImportedCoursesFromJson(trimmedSource).map(normalizeImportedCourse)
  } catch (jsonError) {
    try {
      return normalizeImportedCoursesFromOutline(trimmedSource).map(normalizeImportedCourse)
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

/**
 * Extracts the first lesson and assignment from an import source so the
 * authoring editor can reuse the same parser as bulk import without re-creating
 * catalog parsing in client components.
 */
export function extractAuthoringImportCandidate(source: string): AuthoringImportCandidate {
  const courses = parseCatalogImportSource(source)
  const course = courses[0]
  const lesson = course?.lessons[0]
  const challenge = lesson?.challenges[0]

  if (!course || !lesson || !challenge) {
    throw new Error("Paste an outline that includes at least one chapter and one assignment.")
  }

  const lessonCount = courses.reduce((count, currentCourse) => count + currentCourse.lessons.length, 0)
  const challengeCount = courses.reduce(
    (count, currentCourse) =>
      count + currentCourse.lessons.reduce((lessonTotal, currentLesson) => lessonTotal + currentLesson.challenges.length, 0),
    0
  )

  return {
    course,
    lesson,
    challenge,
    ignoredLessonCount: Math.max(0, lessonCount - 1),
    ignoredChallengeCount: Math.max(0, challengeCount - 1)
  }
}
