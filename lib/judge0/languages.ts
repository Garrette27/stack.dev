import type { Challenge } from "@/lib/types"

type SupportedLanguage = Challenge["language"]

type Judge0LanguageConfig = {
  defaultJudge0LanguageId: number
  editorLanguage: string
  sourceFileLabel: string
  testFileLabel: string
  solutionFileLabel: string
  codeFenceLabel: string
  codeFenceExample: string
  starterTemplate: string
  solutionTemplate: string
  hiddenTestTemplate: string
}

/**
 * Tracks Judge0 language ids we have verified on the current host but are not
 * exposing in authoring until their runner assembly is implemented cleanly.
 */
export const PLANNED_JUDGE0_LANGUAGE_IDS = {
  java: 91
} as const

const LANGUAGE_CONFIGS: Record<SupportedLanguage, Judge0LanguageConfig> = {
  javascript: {
    defaultJudge0LanguageId: 102,
    editorLanguage: "javascript",
    sourceFileLabel: "main.js",
    testFileLabel: "main_test.js",
    solutionFileLabel: "solution.js",
    codeFenceLabel: "javascript",
    codeFenceExample: 'const message = "Hello from stack.dev.ph"\nconsole.log(message)',
    starterTemplate: 'console.log("hello there!")',
    solutionTemplate: 'console.log("Starting Textio server...")',
    hiddenTestTemplate:
      'if (!stackOutput.includes("Starting Textio server...")) {\n  throw new Error("Print the expected text")\n}'
  },
  typescript: {
    defaultJudge0LanguageId: 101,
    editorLanguage: "typescript",
    sourceFileLabel: "main.ts",
    testFileLabel: "main_test.ts",
    solutionFileLabel: "solution.ts",
    codeFenceLabel: "typescript",
    codeFenceExample: 'const message: string = "Hello from stack.dev.ph"\nconsole.log(message)',
    starterTemplate: 'const message: string = "hello there!"\nconsole.log(message)',
    solutionTemplate: 'const message: string = "Starting Textio server..."\nconsole.log(message)',
    hiddenTestTemplate:
      'if (!stackOutput.includes("Starting Textio server...")) {\n  throw new Error("Print the expected text")\n}'
  },
  python: {
    defaultJudge0LanguageId: 71,
    editorLanguage: "python",
    sourceFileLabel: "main.py",
    testFileLabel: "main_test.py",
    solutionFileLabel: "solution.py",
    codeFenceLabel: "python",
    codeFenceExample: 'message = "Hello from stack.dev.ph"\nprint(message)',
    starterTemplate: 'print("hello there!")',
    solutionTemplate: 'print("Starting Textio server...")',
    hiddenTestTemplate: 'assert "Starting Textio server..." in stackOutput'
  },
  go: {
    defaultJudge0LanguageId: 107,
    editorLanguage: "go",
    sourceFileLabel: "main.go",
    testFileLabel: "main_test.go",
    solutionFileLabel: "solution.go",
    codeFenceLabel: "go",
    codeFenceExample: 'package main\n\nfunc main() {\n\tprintln("Hello from stack.dev.ph")\n}',
    starterTemplate: 'package main\n\nfunc main() {\n\tprintln("hello there!")\n}',
    solutionTemplate: 'package main\n\nfunc main() {\n\tprintln("Starting Textio server...")\n}',
    hiddenTestTemplate:
      'if greet("Ada") != "Hello, Ada!" {\n\tpanic("Ada greeting is incorrect")\n}\nif greet("Rico") != "Hello, Rico!" {\n\tpanic("Rico greeting is incorrect")\n}'
  },
  sqlite: {
    defaultJudge0LanguageId: 82,
    editorLanguage: "sql",
    sourceFileLabel: "main.sql",
    testFileLabel: "main_test.sql",
    solutionFileLabel: "solution.sql",
    codeFenceLabel: "sql",
    codeFenceExample: "select 'Hello from stack.dev.ph' as message;",
    starterTemplate: "select 'hello there!' as message;",
    solutionTemplate: "select 'Starting Textio server...' as message;",
    hiddenTestTemplate:
      "select case\n  when exists (\n    select 1\n    from (select 'Starting Textio server...' as message)\n    where message = 'Starting Textio server...'\n  ) then 1\n  else missing_expected_output('Print the expected text')\nend;"
  }
}

export const AUTHORING_LANGUAGE_OPTIONS = Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]

/**
 * Centralizes per-language Judge0/editor defaults so authoring, the workbench,
 * and the runner all stay aligned behind one small interface.
 */
export function getLanguageConfig(language: SupportedLanguage) {
  return LANGUAGE_CONFIGS[language]
}

export function isSupportedChallengeLanguage(value: string): value is SupportedLanguage {
  return value in LANGUAGE_CONFIGS
}

export function getDefaultJudge0LanguageId(language: SupportedLanguage) {
  return getLanguageConfig(language).defaultJudge0LanguageId
}

export function getEditorLanguage(language: SupportedLanguage) {
  return getLanguageConfig(language).editorLanguage
}

export function getSourceFileLabel(language: SupportedLanguage) {
  return getLanguageConfig(language).sourceFileLabel
}

export function getTestFileLabel(language: SupportedLanguage) {
  return getLanguageConfig(language).testFileLabel
}

export function getSolutionFileLabel(language: SupportedLanguage) {
  return getLanguageConfig(language).solutionFileLabel
}

export function getStarterTemplate(language: SupportedLanguage) {
  return getLanguageConfig(language).starterTemplate
}

export function getSolutionTemplate(language: SupportedLanguage) {
  return getLanguageConfig(language).solutionTemplate
}

export function getHiddenTestTemplate(language: SupportedLanguage) {
  return getLanguageConfig(language).hiddenTestTemplate
}

export function getCodeFenceSnippet(language: SupportedLanguage) {
  const config = getLanguageConfig(language)

  return {
    label: config.codeFenceLabel,
    example: config.codeFenceExample
  }
}
