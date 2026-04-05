import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { compileMDX } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"

import { renderHighlightedCode } from "@/lib/code-highlighting"

type MdxRendererProps = {
  source: string
  tone?: "light" | "dark"
}

type ToneColors = {
  heading: string
  body: string
  code: string
  pre: string
  preHeader: string
  blockquote: string
}

type FallbackBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; language: string | null; text: string }

function getToneColors(tone: "light" | "dark"): ToneColors {
  return tone === "dark"
    ? {
        heading: "text-white",
        body: "text-slate-200",
        code: "bg-white/10 text-white",
        pre: "border-white/10 bg-black/20 text-slate-100",
        preHeader: "border-white/10 bg-black/15 text-white/70",
        blockquote: "border-[var(--accent)] bg-white/6 text-slate-200"
      }
    : {
        heading: "text-[var(--ink-strong)]",
        body: "text-[var(--ink)]",
        code: "bg-[color:rgb(31_41_55/0.08)] text-[var(--ink-strong)]",
        pre: "border-black/10 bg-[var(--ink-strong)] text-white",
        preHeader: "border-black/10 bg-black/10 text-white/75",
        blockquote: "border-[var(--accent)] bg-[color:rgb(201_111_54/0.08)] text-[var(--ink)]"
      }
}

function getCodeBlockLanguage(children: ReactNode) {
  const child = Children.toArray(children)[0]

  if (!isValidElement<{ className?: string }>(child)) {
    return null
  }

  const className = child.props.className ?? ""
  const languageMatch = className.match(/language-([\w-]+)/)
  return languageMatch?.[1] ?? null
}

function getCodeBlockFileLabel(language: string | null) {
  switch (language) {
    case "javascript":
    case "js":
      return "example.js"
    case "typescript":
    case "ts":
      return "example.ts"
    case "python":
    case "py":
      return "example.py"
    case "go":
      return "example.go"
    case "sql":
    case "sqlite":
      return "example.sql"
    case "json":
      return "example.json"
    case "bash":
    case "sh":
      return "example.sh"
    default:
      return "example.txt"
  }
}

function getCodeBlockText(children: ReactNode) {
  const child = Children.toArray(children)[0]

  if (!isValidElement<{ children?: ReactNode }>(child)) {
    return ""
  }

  if (typeof child.props.children === "string") {
    return child.props.children
  }

  return Children.toArray(child.props.children).join("")
}

function renderCodePanel(code: string, language: string | null, colors: ToneColors, tone: "light" | "dark") {
  const fileLabel = getCodeBlockFileLabel(language)

  return (
    <div className={`mt-6 overflow-hidden rounded-[1.5rem] border ${colors.pre}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${colors.preHeader}`}>
        <span className="rounded-t-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white">
          {fileLabel}
        </span>
        <span className="text-xs uppercase tracking-[0.22em]">Read only</span>
      </div>
      <pre className="overflow-x-auto p-5 text-sm">
        {renderHighlightedCode(code, language, tone)}
      </pre>
    </div>
  )
}

function guessCodeLanguage(source: string) {
  const trimmed = source.trim()

  if (/^(def |print\(|from |import )/m.test(trimmed)) {
    return "python"
  }

  if (/^(package main|func main\(|func [A-Za-z_][A-Za-z0-9_]*\()/m.test(trimmed)) {
    return "go"
  }

  if (/^(select |create table |insert into |update |delete from |with )/im.test(trimmed)) {
    return "sql"
  }

  if (/:\s*(string|number|boolean|unknown|any|void|Array<)/.test(trimmed) || /interface\s+[A-Z]/.test(trimmed)) {
    return "typescript"
  }

  if (
    /^(const |let |var |function |if\s*\(|for\s*\(|while\s*\(|console\.log|export |import )/m.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return "javascript"
  }

  return null
}

function isLikelyCodeLine(line: string) {
  const trimmed = line.trim()

  if (!trimmed) {
    return false
  }

  return (
    /^(const |let |var |function |if\s*\(|else\b|for\s*\(|while\s*\(|return\b|console\.log|print\(|throw\b|try\b|catch\b|finally\b|class\b|def\b|import\b|export\b)/.test(
      trimmed
    ) ||
    /^(package main|func main\(|func [A-Za-z_][A-Za-z0-9_]*\(|select |create table |insert into |update |delete from |with )/i.test(trimmed) ||
    trimmed.endsWith("{") ||
    trimmed === "}" ||
    trimmed.includes("=>") ||
    trimmed.includes(";")
  )
}

function parseFallbackBlocks(source: string): FallbackBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: FallbackBlock[] = []
  let index = 0

  const flushParagraph = (buffer: string[]) => {
    if (!buffer.length) {
      return
    }

    blocks.push({
      kind: "paragraph",
      text: buffer.join(" ").trim()
    })
    buffer.length = 0
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const fencedMatch = trimmed.match(/^```([\w-]+)?$/)
    if (fencedMatch) {
      const codeLines: string[] = []
      const language = fencedMatch[1] ?? null
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      blocks.push({
        kind: "code",
        language,
        text: codeLines.join("\n")
      })
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim()
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []

      while (index < lines.length) {
        const candidate = lines[index].trim()
        const matchesCurrentList = ordered ? /^\d+\.\s+/.test(candidate) : /^[-*]\s+/.test(candidate)
        if (!candidate || !matchesCurrentList) {
          break
        }

        items.push(candidate.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, "").trim())
        index += 1
      }

      blocks.push({
        kind: "list",
        ordered,
        items
      })
      continue
    }

    if (isLikelyCodeLine(trimmed)) {
      const codeLines: string[] = []

      while (index < lines.length) {
        const candidate = lines[index]
        if (!candidate.trim()) {
          if (index + 1 < lines.length && isLikelyCodeLine(lines[index + 1].trim())) {
            codeLines.push("")
            index += 1
            continue
          }
          break
        }

        if (!isLikelyCodeLine(candidate.trim())) {
          break
        }

        codeLines.push(candidate)
        index += 1
      }

      blocks.push({
        kind: "code",
        language: guessCodeLanguage(codeLines.join("\n")),
        text: codeLines.join("\n")
      })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const candidate = lines[index].trim()
      if (!candidate) {
        break
      }
      if (
        /^```/.test(candidate) ||
        /^(#{1,3})\s+/.test(candidate) ||
        /^[-*]\s+/.test(candidate) ||
        /^\d+\.\s+/.test(candidate) ||
        isLikelyCodeLine(candidate)
      ) {
        break
      }

      paragraphLines.push(candidate)
      index += 1
    }

    flushParagraph(paragraphLines)
  }

  return blocks
}

function renderFallbackBlocks(source: string, colors: ToneColors, tone: "light" | "dark") {
  const blocks = parseFallbackBlocks(source)

  return blocks.map((block, index) => {
    if (block.kind === "heading") {
      if (block.level === 1) {
        return (
          <h1 key={`heading-${index}`} className={`font-serif text-4xl tracking-tight ${colors.heading}`}>
            {block.text}
          </h1>
        )
      }

      if (block.level === 2) {
        return (
          <h2 key={`heading-${index}`} className={`mt-10 font-serif text-2xl tracking-tight ${colors.heading}`}>
            {block.text}
          </h2>
        )
      }

      return (
        <h3 key={`heading-${index}`} className={`mt-8 text-xl font-semibold ${colors.heading}`}>
          {block.text}
        </h3>
      )
    }

    if (block.kind === "list") {
      const ListTag = block.ordered ? "ol" : "ul"

      return (
        <ListTag
          key={`list-${index}`}
          className={`mt-4 ${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6 ${colors.body}`}
        >
          {block.items.map((item, itemIndex) => (
            <li key={`list-item-${index}-${itemIndex}`} className="leading-7">
              {item}
            </li>
          ))}
        </ListTag>
      )
    }

    if (block.kind === "code") {
      return <Fragment key={`code-${index}`}>{renderCodePanel(block.text, block.language, colors, tone)}</Fragment>
    }

    return (
      <p key={`paragraph-${index}`} className={`mt-4 text-base leading-8 ${colors.body}`}>
        {block.text}
      </p>
    )
  })
}

function getMdxComponents(colors: ToneColors, tone: "light" | "dark") {
  return {
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h1 className={`font-serif text-4xl tracking-tight ${colors.heading}`} {...props} />
    ),
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 className={`mt-10 font-serif text-2xl tracking-tight ${colors.heading}`} {...props} />
    ),
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className={`mt-8 text-xl font-semibold ${colors.heading}`} {...props} />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className={`mt-4 text-base leading-8 ${colors.body}`} {...props} />
    ),
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
      <ul className={`mt-4 list-disc space-y-2 pl-6 ${colors.body}`} {...props} />
    ),
    ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
      <ol className={`mt-4 list-decimal space-y-2 pl-6 ${colors.body}`} {...props} />
    ),
    li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li className="leading-7" {...props} />,
    code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
      const isBlockCode = Boolean(className?.includes("language-"))

      return (
        <code
          className={
            isBlockCode ? "font-mono text-sm" : `rounded px-1.5 py-0.5 font-mono text-sm ${colors.code}`
          }
          {...props}
        />
      )
    },
    pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => {
      const language = getCodeBlockLanguage(children)
      const code = getCodeBlockText(children)

      return (
        <div className={`mt-6 overflow-hidden rounded-[1.5rem] border ${colors.pre}`}>
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${colors.preHeader}`}>
            <span className="rounded-t-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white">
              {getCodeBlockFileLabel(language)}
            </span>
            <span className="text-xs uppercase tracking-[0.22em]">Read only</span>
          </div>
          <pre className="overflow-x-auto p-5 text-sm" {...props}>
            {renderHighlightedCode(code, language, tone)}
          </pre>
        </div>
      )
    },
    blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
      <blockquote className={`mt-6 rounded-r-2xl border-l-4 px-4 py-3 ${colors.blockquote}`} {...props} />
    )
  }
}

/**
 * Renders lesson and assignment content with MDX when possible, then degrades
 * gracefully to a markdown-like fallback for authored text that contains raw
 * code snippets and would otherwise take the whole lesson page down.
 */
export async function MdxRenderer({ source, tone = "light" }: MdxRendererProps) {
  const colors = getToneColors(tone)

  try {
    const { content } = await compileMDX({
      source,
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm]
        }
      },
      components: getMdxComponents(colors, tone)
    })

    return content
  } catch {
    return <div>{renderFallbackBlocks(source, colors, tone)}</div>
  }
}
