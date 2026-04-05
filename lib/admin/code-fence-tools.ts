export type AuthoringCodeFenceLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "sqlite"
  | "c"
  | "java"

type CodeFenceToolConfig = {
  fenceLabel: string
  example: string
  buttonLabel: string
}

const CODE_FENCE_TOOL_CONFIGS: Record<AuthoringCodeFenceLanguage, CodeFenceToolConfig> = {
  javascript: {
    fenceLabel: "javascript",
    example: 'const message = "Hello from stack.dev.ph"\nconsole.log(message)',
    buttonLabel: "Insert javascript code block"
  },
  typescript: {
    fenceLabel: "typescript",
    example: 'const message: string = "Hello from stack.dev.ph"\nconsole.log(message)',
    buttonLabel: "Insert typescript code block"
  },
  python: {
    fenceLabel: "python",
    example: 'message = "Hello from stack.dev.ph"\nprint(message)',
    buttonLabel: "Insert python code block"
  },
  go: {
    fenceLabel: "go",
    example: 'package main\n\nfunc main() {\n\tprintln("Hello from stack.dev.ph")\n}',
    buttonLabel: "Insert go code block"
  },
  sqlite: {
    fenceLabel: "sql",
    example: "select 'Hello from stack.dev.ph' as message;",
    buttonLabel: "Insert sqlite code block"
  },
  c: {
    fenceLabel: "c",
    example:
      '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from stack.dev.ph\\n");\n    return 0;\n}',
    buttonLabel: "Insert c code block"
  },
  java: {
    fenceLabel: "java",
    example:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from stack.dev.ph");\n    }\n}',
    buttonLabel: "Insert java code block"
  }
}

export const AUTHORING_CODE_FENCE_LANGUAGES = Object.keys(
  CODE_FENCE_TOOL_CONFIGS
) as AuthoringCodeFenceLanguage[]

type InsertCodeFenceAtSelectionInput = {
  source: string
  selectionStart: number
  selectionEnd: number
  language: AuthoringCodeFenceLanguage
}

type InsertCodeFenceAtSelectionResult = {
  nextSource: string
  selectionStart: number
  selectionEnd: number
}

/**
 * Normalizes persisted toolbar order so authoring can add new code-fence
 * languages without breaking older localStorage payloads.
 */
export function normalizeCodeFenceToolOrder(order: string[] | null | undefined) {
  const remainingLanguages = new Set(AUTHORING_CODE_FENCE_LANGUAGES)
  const normalizedOrder: AuthoringCodeFenceLanguage[] = []

  for (const language of order ?? []) {
    if (!remainingLanguages.has(language as AuthoringCodeFenceLanguage)) {
      continue
    }

    normalizedOrder.push(language as AuthoringCodeFenceLanguage)
    remainingLanguages.delete(language as AuthoringCodeFenceLanguage)
  }

  normalizedOrder.push(...remainingLanguages)

  return normalizedOrder
}

export function getCodeFenceToolConfig(language: AuthoringCodeFenceLanguage) {
  return CODE_FENCE_TOOL_CONFIGS[language]
}

export function getCodeFenceToolButtonLabel(language: AuthoringCodeFenceLanguage) {
  return getCodeFenceToolConfig(language).buttonLabel
}

/**
 * Reorders the toolbar so author-preferred languages stay easy to reach
 * without each editor field managing its own drag bookkeeping.
 */
export function moveCodeFenceTool(
  order: AuthoringCodeFenceLanguage[],
  draggedLanguage: AuthoringCodeFenceLanguage,
  targetLanguage: AuthoringCodeFenceLanguage
) {
  if (draggedLanguage === targetLanguage) {
    return order
  }

  const nextOrder = [...order]
  const draggedIndex = nextOrder.indexOf(draggedLanguage)
  const targetIndex = nextOrder.indexOf(targetLanguage)

  if (draggedIndex < 0 || targetIndex < 0) {
    return order
  }

  nextOrder.splice(draggedIndex, 1)
  nextOrder.splice(targetIndex, 0, draggedLanguage)

  return nextOrder
}

function getLeadingSeparator(beforeText: string) {
  if (!beforeText.length) {
    return ""
  }

  if (beforeText.endsWith("\n\n")) {
    return ""
  }

  if (beforeText.endsWith("\n")) {
    return "\n"
  }

  return "\n\n"
}

function getTrailingSeparator(afterText: string) {
  if (!afterText.length) {
    return "\n"
  }

  if (afterText.startsWith("\n\n")) {
    return ""
  }

  if (afterText.startsWith("\n")) {
    return "\n"
  }

  return "\n\n"
}

/**
 * Inserts a fenced code block at the active textarea selection so authors can
 * add examples in place instead of rebuilding the rest of the reading by hand.
 */
export function insertCodeFenceAtSelection({
  source,
  selectionStart,
  selectionEnd,
  language
}: InsertCodeFenceAtSelectionInput): InsertCodeFenceAtSelectionResult {
  const { fenceLabel, example } = getCodeFenceToolConfig(language)
  const beforeText = source.slice(0, selectionStart)
  const selectedText = source.slice(selectionStart, selectionEnd)
  const afterText = source.slice(selectionEnd)
  const codeBody = selectedText || example
  const leadingSeparator = getLeadingSeparator(beforeText)
  const trailingSeparator = getTrailingSeparator(afterText)
  const fenceHeader = `\`\`\`${fenceLabel}\n`
  const fenceFooter = "\n```"
  const insertedBlock = `${leadingSeparator}${fenceHeader}${codeBody}${fenceFooter}${trailingSeparator}`
  const nextSource = `${beforeText}${insertedBlock}${afterText}`
  const bodySelectionStart = beforeText.length + leadingSeparator.length + fenceHeader.length
  const bodySelectionEnd = bodySelectionStart + codeBody.length

  return {
    nextSource,
    selectionStart: bodySelectionStart,
    selectionEnd: bodySelectionEnd
  }
}
