"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useState, useTransition } from "react"
import { CheckCircle2, LoaderCircle, Play, Save, ShieldCheck, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Challenge, SubmissionOutcome } from "@/lib/types"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

type ChallengeWorkbenchProps = {
  challenge: Challenge
  courseSlug: string
  lessonSlug: string
  isAuthenticated: boolean
}

const initialResult: SubmissionOutcome | null = null

export function ChallengeWorkbench({
  challenge,
  courseSlug,
  lessonSlug,
  isAuthenticated
}: ChallengeWorkbenchProps) {
  const [sourceCode, setSourceCode] = useState(challenge.starterCode)
  const [result, setResult] = useState<SubmissionOutcome | null>(initialResult)
  const [pending, startTransition] = useTransition()
  const [saving, startSavingTransition] = useTransition()

  const handleRun = () => {
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

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.94))] shadow-[0_28px_80px_rgba(25,31,45,0.08)]">
        <CardHeader className="border-b border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,247,240,0.8))] p-8 sm:p-9">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-[color:rgb(25_31_45/0.08)] text-[var(--ink-strong)]">Your answer</Badge>
                <Badge>{challenge.language}</Badge>
              </div>
              <CardTitle className="mt-4 font-serif text-4xl">Code editor</CardTitle>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">
                Solve the prompt, run the hidden checks, and keep your place automatically.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-black/8 bg-[var(--ink-strong)] px-5 py-4 text-white shadow-[0_16px_40px_rgba(25,31,45,0.18)]">
              <p className="text-xs uppercase tracking-[0.22em] text-white/60">Flow</p>
              <div className="mt-2 space-y-1.5">
                <p className="text-sm font-medium text-white">Write solution</p>
                <p className="text-sm font-medium text-white">Run hidden checks</p>
                <p className="text-sm font-medium text-white">Keep progress synced</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <MonacoEditor
            height="720px"
            defaultLanguage={challenge.language === "python" ? "python" : "javascript"}
            theme="vs-dark"
            value={sourceCode}
            onChange={(value) => setSourceCode(value ?? "")}
            options={{
              fontSize: 15,
              minimap: { enabled: false },
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/6 bg-[color:rgb(255_255_255/0.82)] px-7 py-5 sm:px-8">
            <div className="flex gap-3">
              <Button type="button" onClick={handleRun} disabled={pending}>
                {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run check
              </Button>
              <Button type="button" variant="secondary" onClick={handleSaveForLater} disabled={saving}>
                {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save for later
              </Button>
            </div>
            {!isAuthenticated ? (
              <p className="text-sm text-[var(--ink-muted)]">
                <Link href="/login" className="font-medium text-[var(--ink-strong)] underline decoration-[var(--accent)]">
                  Sign in with Google
                </Link>{" "}
                to sync progress.
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">Your progress is synced when a check runs or you save.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,251,255,0.92))]">
          <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.72)] p-8 pb-6 sm:p-9 sm:pb-7">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Review</p>
            <CardTitle className="mt-3 flex items-center gap-2 font-serif text-3xl">
              <Terminal className="h-5 w-5 text-[var(--accent)]" />
              Latest result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-8 pt-6 sm:p-9 sm:pt-7">
            {result ? (
              <>
                <div
                  className={`rounded-[1.75rem] px-5 py-4 text-sm shadow-[0_16px_40px_rgba(25,31,45,0.06)] ${
                    result.passed
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {result.passed ? <CheckCircle2 className="h-4 w-4" /> : null}
                    {result.feedback}
                  </div>
                </div>
                <dl className="grid gap-3 text-sm text-[var(--ink)]">
                  <div>
                    <dt className="font-semibold text-[var(--ink-strong)]">Status</dt>
                    <dd>{result.status}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--ink-strong)]">Standard output</dt>
                    <dd className="rounded-[1.5rem] bg-[var(--ink-strong)] p-4 font-mono text-xs text-white">
                      {result.stdout || "(empty)"}
                    </dd>
                  </div>
                  {result.stderr ? (
                    <div>
                      <dt className="font-semibold text-[var(--ink-strong)]">Errors</dt>
                      <dd className="rounded-[1.5rem] bg-rose-950 p-4 font-mono text-xs text-rose-100">{result.stderr}</dd>
                    </div>
                  ) : null}
                </dl>
              </>
            ) : (
              <div className="space-y-4 text-sm leading-7 text-[var(--ink-muted)]">
                <div className="rounded-[1.75rem] border border-dashed border-black/12 bg-[color:rgb(25_31_45/0.03)] px-5 py-4 text-[var(--ink)]">
                  Run the checker to see whether the hidden tests pass.
                </div>
                <p className="rounded-[1.75rem] bg-[color:rgb(25_31_45/0.04)] px-5 py-4 text-[var(--ink)]">
                  This panel shows pass/fail, stdout, and runtime errors after each submission.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,241,0.92))]">
          <CardHeader className="border-b border-black/6 bg-[color:rgb(255_255_255/0.72)] p-8 pb-6 sm:p-9 sm:pb-7">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">Check design</p>
            <CardTitle className="mt-3 flex items-center gap-2 font-serif text-3xl">
              <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
              What the checker looks for
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-8 pt-6 text-sm leading-7 text-[var(--ink)] sm:p-9 sm:pt-7">
            <p>The public prompt stays visible. The hidden tests stay on the server.</p>
            <p>The answer key stays private while the learner still gets a realistic practice loop.</p>
            <p className="rounded-[1.75rem] bg-[color:rgb(25_31_45/0.05)] px-5 py-4">
              Authoring rule: one lesson, one challenge, one idea.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
