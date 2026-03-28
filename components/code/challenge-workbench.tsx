"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, LoaderCircle, Play, Save, Send, Sparkles, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Challenge, SubmissionOutcome } from "@/lib/types"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

type ChallengeWorkbenchProps = {
  challenge: Challenge
  courseSlug: string
  lessonSlug: string
  isAuthenticated: boolean
}

const initialResult: SubmissionOutcome | null = null

function getSourceFileLabel(language: Challenge["language"]) {
  return language === "python" ? "main.py" : "main.js"
}

function getTestFileLabel(language: Challenge["language"]) {
  return language === "python" ? "main_test.py" : "main_test.js"
}

function getSolutionFileLabel(language: Challenge["language"]) {
  return language === "python" ? "solution.py" : "solution.js"
}

function getReadableModeLabel(readOnly: boolean) {
  return readOnly ? "Read only" : "Editable"
}

type EditorPaneProps = {
  editorKey: string
  path: string
  language: string
  value: string
  height: string
  readOnly: boolean
  badgeLabel: string
  className?: string
  onChange?: (value: string) => void
}

function EditorPane({
  editorKey,
  path,
  language,
  value,
  height,
  readOnly,
  badgeLabel,
  className,
  onChange
}: EditorPaneProps) {
  return (
    <div className={cn("min-w-0 overflow-hidden bg-[#171d29]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1b2230] px-4 py-3">
        <span className="rounded-t-xl border border-white/15 bg-[#232b39] px-3 py-2 text-sm font-semibold text-white">
          {path}
        </span>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/10 text-white">{badgeLabel}</Badge>
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">{getReadableModeLabel(readOnly)}</span>
        </div>
      </div>
      <MonacoEditor
        key={editorKey}
        path={path}
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => {
          if (!readOnly) {
            onChange?.(nextValue ?? "")
          }
        }}
        options={{
          fontSize: 15,
          minimap: { enabled: false },
          padding: { top: 16 },
          readOnly,
          scrollBeyondLastLine: false,
          smoothScrolling: true
        }}
      />
    </div>
  )
}

/**
 * Hosts the learner code workspace, keeps editable source isolated from test
 * and solution views, and surfaces submission feedback without leaking runner
 * details into the page component.
 */
export function ChallengeWorkbench({
  challenge,
  courseSlug,
  lessonSlug,
  isAuthenticated
}: ChallengeWorkbenchProps) {
  const [sourceCode, setSourceCode] = useState(challenge.starterCode)
  const [activeFile, setActiveFile] = useState<"source" | "tests">("source")
  const [showSolutionPane, setShowSolutionPane] = useState(false)
  const [result, setResult] = useState<SubmissionOutcome | null>(initialResult)
  const [pending, startTransition] = useTransition()
  const [saving, startSavingTransition] = useTransition()

  useEffect(() => {
    setSourceCode(challenge.starterCode)
    setResult(initialResult)
    setActiveFile("source")
    setShowSolutionPane(false)
  }, [challenge.slug, challenge.starterCode])

  const runSubmission = () => {
    startTransition(async () => {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          challengeSlug: challenge.slug,
          courseSlug,
          lessonSlug,
          sourceCode
        })
      })

      const payload = (await response.json()) as SubmissionOutcome
      setResult(payload)
    })
  }

  const handleToggleSolutionPane = () => {
    setShowSolutionPane((current) => !current)
  }

  const handleSaveForLater = () => {
    startSavingTransition(async () => {
      await fetch("/api/progress/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          courseSlug,
          lessonSlug
        })
      })
    })
  }

  const editorLanguage = challenge.language === "python" ? "python" : "javascript"
  const sourceFileLabel = getSourceFileLabel(challenge.language)
  const testFileLabel = getTestFileLabel(challenge.language)
  const solutionFileLabel = getSolutionFileLabel(challenge.language)
  const isShowingTests = activeFile === "tests"
  const editorHeight = showSolutionPane ? "58vh" : "62vh"
  const visibleEditorPath = isShowingTests ? testFileLabel : sourceFileLabel
  const visibleEditorValue = isShowingTests ? challenge.hiddenTestCode : sourceCode

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,#141923,#121722)] text-white shadow-[0_24px_70px_rgba(11,15,24,0.36)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFile("source")}
            className={`rounded-t-xl border px-3 py-2 text-sm font-semibold transition ${
              activeFile === "source"
                ? "border-white/15 bg-[#1b2230] text-white shadow-[inset_0_-2px_0_var(--accent)]"
                : "border-white/8 bg-white/5 text-white/60 hover:bg-white/8 hover:text-white"
            }`}
          >
            {sourceFileLabel}
          </button>
          <button
            type="button"
            onClick={() => setActiveFile("tests")}
            className={`rounded-t-xl border px-3 py-2 text-sm font-semibold transition ${
              activeFile === "tests"
                ? "border-white/15 bg-[#1b2230] text-white shadow-[inset_0_-2px_0_var(--accent)]"
                : "border-white/8 bg-white/5 text-white/60 hover:bg-white/8 hover:text-white"
            }`}
          >
            {testFileLabel}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/10 text-white">{challenge.language}</Badge>
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">{getReadableModeLabel(isShowingTests)}</span>
        </div>
      </div>

      <div className={cn("border-b border-white/10", showSolutionPane && "grid gap-px bg-white/10 xl:grid-cols-2")}>
        <EditorPane
          editorKey={`${challenge.slug}-${activeFile}`}
          path={visibleEditorPath}
          language={editorLanguage}
          value={visibleEditorValue}
          height={editorHeight}
          readOnly={isShowingTests}
          badgeLabel={challenge.language}
          className={showSolutionPane ? "xl:border-r xl:border-white/10" : undefined}
          onChange={setSourceCode}
        />

        {showSolutionPane ? (
          <EditorPane
            editorKey={`${challenge.slug}-solution`}
            path={solutionFileLabel}
            language={editorLanguage}
            value={challenge.solutionCode}
            height={editorHeight}
            readOnly
            badgeLabel={challenge.language}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="accent" onClick={runSubmission} disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={runSubmission}
            disabled={pending}
            className="border-white/10 bg-white/10 text-white hover:bg-white/16"
          >
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run
          </Button>
          <Button
            type="button"
            variant={showSolutionPane ? "accent" : "secondary"}
            onClick={handleToggleSolutionPane}
            className={cn(
              showSolutionPane
                ? "text-white"
                : "border-white/10 bg-white/10 text-white hover:bg-white/16"
            )}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {showSolutionPane ? "Hide solution" : "Solution"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveForLater}
            disabled={saving}
            className="border-white/10 bg-transparent text-white/85 hover:bg-white/10"
          >
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
        {!isAuthenticated ? (
          <p className="text-sm text-white/60">
            <Link href="/login" className="font-medium text-white underline decoration-[var(--accent)]">
              Sign in with Google
            </Link>{" "}
            to sync progress.
          </p>
        ) : (
          <p className="text-sm text-white/55">Progress syncs when you submit or save.</p>
        )}
      </div>

      <div className="grid gap-4 p-4">
        <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white">
            <Terminal className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold">Latest result</h3>
          </div>
          {result ? (
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-[1rem] px-4 py-3 text-sm ${
                  result.passed
                    ? "bg-emerald-500/14 text-emerald-200 ring-1 ring-emerald-400/20"
                    : "bg-amber-400/12 text-amber-100 ring-1 ring-amber-400/15"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {result.passed ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {result.feedback}
                </div>
              </div>

              <dl className="grid gap-3 text-sm text-white/75">
                <div>
                  <dt className="font-semibold text-white">Status</dt>
                  <dd>{result.status}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Standard output</dt>
                  <dd className="mt-2 rounded-[1rem] bg-black/20 p-4 font-mono text-xs text-slate-100">
                    {result.stdout || "(empty)"}
                  </dd>
                </div>
                {result.compileOutput ? (
                  <div>
                    <dt className="font-semibold text-white">Compile output</dt>
                    <dd className="mt-2 rounded-[1rem] bg-amber-950/70 p-4 font-mono text-xs text-amber-100">
                      {result.compileOutput}
                    </dd>
                  </div>
                ) : null}
                {result.stderr ? (
                  <div>
                    <dt className="font-semibold text-white">Errors</dt>
                    <dd className="mt-2 rounded-[1rem] bg-rose-950/80 p-4 font-mono text-xs text-rose-100">{result.stderr}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/55">
              Submit or run this assignment to see the output and pass/fail result here.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
