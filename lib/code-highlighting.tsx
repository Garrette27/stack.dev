import { Fragment } from "react"

type HighlightTone = "light" | "dark"
type TokenKind = "plain" | "comment" | "string" | "keyword" | "number" | "identifier" | "function" | "operator"

type Token = {
  kind: TokenKind
  value: string
}

const C_LIKE_KEYWORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "else",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while"
])

const PYTHON_KEYWORDS = new Set([
  "and",
  "as",
  "class",
  "def",
  "elif",
  "else",
  "False",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "not",
  "or",
  "return",
  "True",
  "try",
  "while"
])

const SQL_KEYWORDS = new Set([
  "and",
  "as",
  "by",
  "case",
  "create",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "from",
  "group",
  "having",
  "insert",
  "into",
  "join",
  "left",
  "limit",
  "offset",
  "on",
  "or",
  "order",
  "right",
  "select",
  "set",
  "table",
  "then",
  "union",
  "update",
  "values",
  "when",
  "where",
  "with"
])

const BASH_KEYWORDS = new Set([
  "case",
  "do",
  "done",
  "elif",
  "else",
  "esac",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "then",
  "until",
  "while"
])

function getTokenClass(kind: TokenKind, tone: HighlightTone) {
  if (tone === "dark") {
    switch (kind) {
      case "comment":
        return "text-emerald-300"
      case "string":
        return "text-amber-300"
      case "keyword":
        return "text-sky-300"
      case "number":
        return "text-fuchsia-300"
      case "identifier":
        return "text-cyan-100"
      case "function":
        return "text-indigo-200"
      case "operator":
        return "text-orange-200"
      default:
        return "text-slate-100"
    }
  }

  switch (kind) {
    case "comment":
      return "text-emerald-700"
    case "string":
      return "text-amber-700"
    case "keyword":
      return "text-sky-700"
    case "number":
      return "text-fuchsia-700"
    case "identifier":
      return "text-cyan-700"
    case "function":
      return "text-indigo-700"
    case "operator":
      return "text-orange-700"
    default:
      return "text-[var(--ink-strong)]"
  }
}

function getLanguageFamily(language: string | null) {
  switch ((language ?? "").toLowerCase()) {
    case "javascript":
    case "js":
    case "typescript":
    case "ts":
    case "go":
    case "c":
    case "java":
      return "clike"
    case "python":
    case "py":
      return "python"
    case "sql":
    case "sqlite":
      return "sql"
    case "bash":
    case "sh":
      return "bash"
    case "json":
      return "json"
    default:
      return "plain"
  }
}

function matchStringToken(source: string, start: number, delimiter: string) {
  let index = start + 1

  while (index < source.length) {
    const character = source[index]
    if (character === "\\") {
      index += 2
      continue
    }

    if (character === delimiter) {
      return source.slice(start, index + 1)
    }

    index += 1
  }

  return source.slice(start)
}

function matchNumberToken(source: string, start: number) {
  const match = source.slice(start).match(/^\d+(?:\.\d+)?/)
  return match?.[0] ?? null
}

function matchWordToken(source: string, start: number) {
  const match = source.slice(start).match(/^[A-Za-z_][A-Za-z0-9_]*/)
  return match?.[0] ?? null
}

function matchOperatorToken(source: string, start: number) {
  const match = source.slice(start).match(/^(?:===|!==|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|%=|&&|\|\||=>|[=+\-*/%<>!&|?:])/)
  return match?.[0] ?? null
}

function getNextNonWhitespaceCharacter(source: string, start: number) {
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (character && !/\s/.test(character)) {
      return character
    }
  }

  return null
}

function classifyWordToken(
  line: string,
  wordToken: string,
  wordStart: number,
  keywords: Set<string>,
  normalizeWord?: (word: string) => string
): TokenKind {
  const normalizedWord = normalizeWord ? normalizeWord(wordToken) : wordToken
  if (keywords.has(normalizedWord)) {
    return "keyword"
  }

  const nextNonWhitespaceCharacter = getNextNonWhitespaceCharacter(line, wordStart + wordToken.length)
  return nextNonWhitespaceCharacter === "(" ? "function" : "identifier"
}

function tokenizePlainLine(line: string, keywords: Set<string>, normalizeWord?: (word: string) => string) {
  const tokens: Token[] = []
  let index = 0

  while (index < line.length) {
    const character = line[index]

    if (character === '"' || character === "'" || character === "`") {
      const value = matchStringToken(line, index, character)
      tokens.push({ kind: "string", value })
      index += value.length
      continue
    }

    const numberToken = matchNumberToken(line, index)
    if (numberToken) {
      tokens.push({ kind: "number", value: numberToken })
      index += numberToken.length
      continue
    }

    const wordToken = matchWordToken(line, index)
    if (wordToken) {
      tokens.push({
        kind: classifyWordToken(line, wordToken, index, keywords, normalizeWord),
        value: wordToken
      })
      index += wordToken.length
      continue
    }

    const operatorToken = matchOperatorToken(line, index)
    if (operatorToken) {
      tokens.push({ kind: "operator", value: operatorToken })
      index += operatorToken.length
      continue
    }

    tokens.push({ kind: "plain", value: character })
    index += 1
  }

  return tokens
}

function tokenizeClikeLine(line: string, inBlockComment: boolean) {
  const tokens: Token[] = []
  let index = 0
  let nextInBlockComment = inBlockComment

  while (index < line.length) {
    if (nextInBlockComment) {
      const endIndex = line.indexOf("*/", index)
      if (endIndex === -1) {
        tokens.push({ kind: "comment", value: line.slice(index) })
        return { tokens, inBlockComment: true }
      }

      tokens.push({ kind: "comment", value: line.slice(index, endIndex + 2) })
      index = endIndex + 2
      nextInBlockComment = false
      continue
    }

    if (line.startsWith("//", index)) {
      tokens.push({ kind: "comment", value: line.slice(index) })
      break
    }

    if (line.startsWith("/*", index)) {
      const endIndex = line.indexOf("*/", index + 2)
      if (endIndex === -1) {
        tokens.push({ kind: "comment", value: line.slice(index) })
        return { tokens, inBlockComment: true }
      }

      tokens.push({ kind: "comment", value: line.slice(index, endIndex + 2) })
      index = endIndex + 2
      continue
    }

    const character = line[index]
    if (character === '"' || character === "'" || character === "`") {
      const value = matchStringToken(line, index, character)
      tokens.push({ kind: "string", value })
      index += value.length
      continue
    }

    const numberToken = matchNumberToken(line, index)
    if (numberToken) {
      tokens.push({ kind: "number", value: numberToken })
      index += numberToken.length
      continue
    }

    const wordToken = matchWordToken(line, index)
    if (wordToken) {
      tokens.push({
        kind: classifyWordToken(line, wordToken, index, C_LIKE_KEYWORDS),
        value: wordToken
      })
      index += wordToken.length
      continue
    }

    const operatorToken = matchOperatorToken(line, index)
    if (operatorToken) {
      tokens.push({ kind: "operator", value: operatorToken })
      index += operatorToken.length
      continue
    }

    tokens.push({ kind: "plain", value: character })
    index += 1
  }

  return { tokens, inBlockComment: nextInBlockComment }
}

function tokenizeLine(
  line: string,
  language: string | null,
  inBlockComment: boolean
): { tokens: Token[]; inBlockComment: boolean } {
  const family = getLanguageFamily(language)

  if (family === "clike") {
    return tokenizeClikeLine(line, inBlockComment)
  }

  if (family === "python") {
    const commentIndex = line.indexOf("#")
    if (commentIndex >= 0) {
      return {
        tokens: [
          ...tokenizePlainLine(line.slice(0, commentIndex), PYTHON_KEYWORDS),
          { kind: "comment" as const, value: line.slice(commentIndex) }
        ],
        inBlockComment: false
      }
    }

    return {
      tokens: tokenizePlainLine(line, PYTHON_KEYWORDS),
      inBlockComment: false
    }
  }

  if (family === "sql") {
    const commentIndex = line.indexOf("--")
    if (commentIndex >= 0) {
      return {
        tokens: [
          ...tokenizePlainLine(line.slice(0, commentIndex), SQL_KEYWORDS, (word) => word.toLowerCase()),
          { kind: "comment" as const, value: line.slice(commentIndex) }
        ],
        inBlockComment: false
      }
    }

    return {
      tokens: tokenizePlainLine(line, SQL_KEYWORDS, (word) => word.toLowerCase()),
      inBlockComment: false
    }
  }

  if (family === "bash") {
    const commentIndex = line.indexOf("#")
    if (commentIndex >= 0) {
      return {
        tokens: [
          ...tokenizePlainLine(line.slice(0, commentIndex), BASH_KEYWORDS),
          { kind: "comment" as const, value: line.slice(commentIndex) }
        ],
        inBlockComment: false
      }
    }

    return {
      tokens: tokenizePlainLine(line, BASH_KEYWORDS),
      inBlockComment: false
    }
  }

  if (family === "json") {
    return {
      tokens: tokenizePlainLine(line, new Set(["true", "false", "null"])),
      inBlockComment: false
    }
  }

  return {
    tokens: [{ kind: "plain" as const, value: line }],
    inBlockComment: false
  }
}

/**
 * Renders small read-only code panels with lightweight syntax coloring so
 * authored lesson examples stay visually close to the interactive editor.
 */
export function renderHighlightedCode(code: string, language: string | null, tone: HighlightTone) {
  const lines = code.split("\n")
  let inBlockComment = false

  return (
    <code className={`font-mono text-sm ${getTokenClass("plain", tone)}`}>
      {lines.map((line, lineIndex) => {
        const result = tokenizeLine(line, language, inBlockComment)
        inBlockComment = result.inBlockComment

        return (
          <Fragment key={`line-${lineIndex}`}>
            {result.tokens.map((token, tokenIndex) => (
              <span key={`token-${lineIndex}-${tokenIndex}`} className={getTokenClass(token.kind, tone)}>
                {token.value}
              </span>
            ))}
            {lineIndex < lines.length - 1 ? "\n" : null}
          </Fragment>
        )
      })}
    </code>
  )
}
