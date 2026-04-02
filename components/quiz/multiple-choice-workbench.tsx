"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { CheckCircle2, LoaderCircle, RotateCcw, Sparkles, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Challenge, SubmissionOutcome } from "@/lib/types"

type MultipleChoiceWorkbenchProps = {
  challenge: Challenge
  courseSlug: string
  lessonSlug: string
  isAuthenticated: boolean
  isCompleted: boolean
  onCompletionChange?: (challengeSlug: string, completed: boolean) => void
}

const initialResult: SubmissionOutcome | null = null

function getChoiceLetter(index: number) {
  return String.fromCharCode(65 + index)
}

/**
 * Presents multiple-choice assignments as immediate-feedback choices while
 * reusing the same submission and progress pipeline as code challenges.
 */
export function MultipleChoiceWorkbench({
  challenge,
  courseSlug,
  lessonSlug,
  isAuthenticated,
  isCompleted,
  onCompletionChange
}: MultipleChoiceWorkbenchProps) {
  const router = useRouter()
  const [selectedChoiceKey, setSelectedChoiceKey] = useState<string | null>(null)
  const [result, setResult] = useState<SubmissionOutcome | null>(initialResult)
  const [pending, startTransition] = useTransition()
  const [resetting, startResetTransition] = useTransition()

  useEffect(() => {
    setSelectedChoiceKey(null)
    setResult(initialResult)
  }, [challenge.slug, isAuthenticated])

  const submitChoice = (choiceKey: string) => {
    if (!isAuthenticated || isCompleted) {
      return
    }

    setSelectedChoiceKey(choiceKey)
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
          selectedChoiceKey: choiceKey
        })
      })

      const payload = (await response.json()) as SubmissionOutcome
      setResult(payload)

      if (payload.passed) {
        onCompletionChange?.(challenge.slug, true)
        router.refresh()
      }
    })
  }

  const handleResetProgress = () => {
    if (!isAuthenticated || !isCompleted) {
      return
    }

    startResetTransition(async () => {
      const response = await fetch("/api/progress/challenge/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          courseSlug,
          lessonSlug,
          challengeSlug: challenge.slug
        })
      })

      if (!response.ok) {
        return
      }

      setSelectedChoiceKey(null)
      setResult(initialResult)
      onCompletionChange?.(challenge.slug, false)
      router.refresh()
    })
  }

  const isLocked = !isAuthenticated || isCompleted || result?.passed

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,#141923,#121722)] text-white shadow-[0_24px_70px_rgba(11,15,24,0.36)]">
      <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Badge className="bg-white/10 text-white">Multiple choice</Badge>
            <h3 className="max-w-2xl text-2xl font-semibold leading-tight text-white whitespace-pre-wrap">
              {challenge.promptMdx}
            </h3>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">
            Click once to check
          </span>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-6">
        {challenge.choiceOptions.map((option, index) => {
          const isSelected = option.key === selectedChoiceKey
          const isCorrectSelection = isSelected && Boolean(result?.passed)
          const isWrongSelection = isSelected && Boolean(result && !result.passed)

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => submitChoice(option.key)}
              disabled={pending || isLocked}
              className={cn(
                "grid min-h-20 w-full gap-2 rounded-[1.25rem] border px-5 py-4 text-left transition",
                "border-white/12 bg-white/6 hover:border-white/20 hover:bg-white/10",
                pending && isSelected && "opacity-75",
                isCorrectSelection && "border-emerald-400/40 bg-emerald-500/14 text-emerald-100",
                isWrongSelection && "border-rose-400/40 bg-rose-500/14 text-rose-100",
                isLocked && !isSelected && "hover:border-white/12 hover:bg-white/6"
              )}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/8 text-sm font-semibold">
                  {getChoiceLetter(index)}
                </span>
                <span className="text-base leading-7">{option.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="border-t border-white/10 bg-white/4 px-5 py-4">
        {!isAuthenticated ? (
          <p className="text-sm text-white/60">
            <Link href="/login" className="font-medium text-white underline decoration-[var(--accent)]">
              Sign in with Google
            </Link>{" "}
            to answer this quiz and save progress.
          </p>
        ) : isCompleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">This multiple-choice assignment is already marked complete.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetProgress}
              disabled={resetting}
              className="border-white/10 bg-transparent text-white/85 hover:bg-white/10"
            >
              {resetting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Clear progress
            </Button>
          </div>
        ) : (
          <p className="text-sm text-white/55">Choose an answer to see immediate feedback. Correct answers mark the assignment complete.</p>
        )}
      </div>

      <div className="border-t border-white/10 px-5 py-5">
        <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold">Latest result</h3>
          </div>

          {pending ? (
            <div className="mt-4 flex items-center gap-3 rounded-[1rem] bg-white/6 px-4 py-3 text-sm text-white/70">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Checking your answer...
            </div>
          ) : result ? (
            <div className="mt-4 space-y-4">
              <div
                className={cn(
                  "rounded-[1rem] px-4 py-3 text-sm",
                  result.passed
                    ? "bg-emerald-500/14 text-emerald-200 ring-1 ring-emerald-400/20"
                    : "bg-rose-500/14 text-rose-100 ring-1 ring-rose-400/20"
                )}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {result.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {result.feedback}
                </div>
              </div>

              {challenge.choiceExplanationMdx.trim() ? (
                <div className="rounded-[1rem] bg-black/16 px-4 py-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                  {challenge.choiceExplanationMdx}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/55">
              Pick an option on the right to see whether it is correct.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
