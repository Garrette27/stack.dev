"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BookOpenText, Lightbulb, Search, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type SearchableLesson = {
  id: string
  href: string
  title: string
  sectionLabel: string
  bodyMdx: string
}

type LessonReadingSearchProps = {
  currentHref: string
  entries: SearchableLesson[]
  initialQuery?: string
  referenceEntryId?: string | null
}

function buildReaderCardHref(currentHref: string, referenceId: string, searchQuery: string) {
  const [pathname, currentSearch = ""] = currentHref.split("?")
  const params = new URLSearchParams(currentSearch)

  params.set("reference", referenceId)

  if (searchQuery.trim()) {
    params.set("search", searchQuery.trim())
  } else {
    params.delete("search")
  }

  const nextSearch = params.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}

function stripMdx(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_\-\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildExcerpt(text: string, query: string) {
  const normalizedText = stripMdx(text)
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return normalizedText.slice(0, 140)
  }

  const matchIndex = normalizedText.toLowerCase().indexOf(normalizedQuery)
  if (matchIndex < 0) {
    return normalizedText.slice(0, 140)
  }

  const start = Math.max(matchIndex - 45, 0)
  const end = Math.min(matchIndex + normalizedQuery.length + 70, normalizedText.length)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < normalizedText.length ? "..." : ""

  return `${prefix}${normalizedText.slice(start, end)}${suffix}`
}

/**
 * Keeps course-reading search and reference navigation in one place so the
 * lesson page doesn't need to know how result links and excerpts work.
 */
export function LessonReadingSearch({
  currentHref,
  entries,
  initialQuery = "",
  referenceEntryId
}: LessonReadingSearchProps) {
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return []
    }

    return entries
      .map((entry) => ({
        entry,
        haystack: `${entry.title} ${entry.sectionLabel} ${stripMdx(entry.bodyMdx)}`.toLowerCase()
      }))
      .filter((item) => item.haystack.includes(normalizedQuery))
      .slice(0, 6)
  }, [entries, query])

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <Search className="h-4 w-4 text-[var(--accent)]" />
        <div>
          <h3 className="font-serif text-2xl text-white">Search this course</h3>
          <p className="text-sm text-white/55">Find related reading across the current course.</p>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5">
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">Search readings</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search terms, concepts, or examples"
            className="h-11 rounded-xl border border-white/10 bg-[#171d29] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--accent)]"
          />
        </label>

        {query ? (
          results.length ? (
            <div className="grid gap-3">
              {results.map(({ entry }) => {
                const isCurrent = entry.href === currentHref

                return (
                  <Link
                    key={entry.id}
                    href={buildReaderCardHref(currentHref, entry.id, query)}
                    className={`rounded-[1rem] border px-4 py-3 transition ${
                      referenceEntryId === entry.id
                        ? "border-[var(--accent-soft)] bg-[color:rgb(201_111_54/0.12)]"
                        : "border-white/10 bg-[#171d29] hover:bg-white/8"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">
                      {entry.title}
                      {isCurrent ? <span className="ml-2 text-xs uppercase tracking-[0.22em] text-[var(--accent-soft)]">Current</span> : null}
                      {referenceEntryId === entry.id ? (
                        <span className="ml-2 text-xs uppercase tracking-[0.22em] text-[var(--accent-soft)]">Showing below</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">{entry.sectionLabel}</p>
                    <p className="mt-2 text-sm leading-7 text-white/65">{buildExcerpt(entry.bodyMdx, query)}</p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[1rem] border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/55">
              No matching reading was found in this course yet.
            </div>
          )
        ) : (
          <div className="rounded-[1rem] border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/55">
            Search by topic, term, or example to jump to related reading in this course.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Keeps the future AI-learning helpers grouped behind one card so the lesson
 * page can place the whole panel without knowing its internal layout.
 */
export function LessonAiHelpPanel() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <div>
          <h3 className="font-serif text-2xl text-white">AI help</h3>
          <p className="text-sm text-white/55">Reserved for guided explanations and hints.</p>
        </div>
      </div>
      <div className="grid gap-3 px-5 py-5">
        <div className="rounded-[1rem] border border-white/10 bg-[#171d29] px-4 py-3">
          <div className="flex items-start gap-3">
            <BookOpenText className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-white">Explain the reading</p>
              <p className="mt-1 text-sm leading-7 text-white/60">Summarize the current chapter in simpler language and connect it to previous lessons.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[1rem] border border-white/10 bg-[#171d29] px-4 py-3">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-white">Explain my result</p>
              <p className="mt-1 text-sm leading-7 text-white/60">Use the latest checker feedback to explain why the answer failed and what to try next.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled className="border-white/10 bg-white/10 text-white/55">
            Explain reading
          </Button>
          <Button type="button" variant="secondary" disabled className="border-white/10 bg-white/10 text-white/55">
            Explain result
          </Button>
        </div>
        <p className="text-sm leading-7 text-white/50">
          AI guidance is not live yet. This panel is ready for an assistant that can explain the reading, the assignment, or the latest checker result.
        </p>
      </div>
    </div>
  )
}
