"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, LoaderCircle, Play, Save, Send, Sparkles, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export function ChallengeWorkbench({
  challenge,
  courseSlug,
  lessonSlug,
  isAuthenticated
}: ChallengeWorkbenchProps) {
  const [sourceCode, setSourceCode] = useState(challenge.starterCode)
  const [activeFile, setActiveFile] = useState<"source" | "tests">("source")
  const [result, setResult] = useState<SubmissionOutcome | null>(initialResult)
  const [pending, startTransition] = useTransition()
  const [saving, startSavingTransition] = useTransition()

  useEffect(() => {
    setSourceCode(challenge.starterCode)
    setResult(initialResult)
    setActiveFile("source")
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

  const handleUseSolution = () => {
    setActiveFile("source")
    setSourceCode(challenge.solutionCode)
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
  const isShowingTests = activeFile === "tests"

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
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">
            {isShowingTests ? "Read only" : "Editable"}
          </span>
        </div>
      </div>

      <div className="border-b border-white/10">
        <MonacoEditor
          height="62vh"
          defaultLanguage={editorLanguage}
          theme="vs-dark"
          value={isShowingTests ? challenge.hiddenTestCode : sourceCode}
          onChange={(value) => {
            if (!isShowingTests) {
              setSourceCode(value ?? "")
            }
          }}
          options={{
            fontSize: 15,
            minimap: { enabled: false },
            padding: { top: 16 },
            readOnly: isShowingTests,
            scrollBeyondLastLine: false,
            smoothScrolling: true
          }}
        />
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
            variant="secondary"
            onClick={handleUseSolution}
            className="border-white/10 bg-white/10 text-white hover:bg-white/16"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Solution
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
