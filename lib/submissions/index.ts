import "server-only"

import { z } from "zod"

import { getRunnerChallengeBySlug } from "@/lib/admin"
import { hasJudge0Env, hasSupabaseEnv } from "@/lib/env"
import { saveResumeStateForUser } from "@/lib/progress"
import { saveChallengeReviewResult } from "@/lib/review"
import { createClient } from "@/lib/supabase/server"
import type { Challenge, SubmissionOutcome } from "@/lib/types"

const PASS_MARKER = "__STACK_DEV_PH_PASS__"
const PROCESSING_STATUS_IDS = new Set([1, 2])
const JUDGE0_POLL_ATTEMPTS = 20
const JUDGE0_POLL_DELAY_MS = 400

export const submissionSchema = z.object({
  challengeSlug: z.string().min(3),
  courseSlug: z.string().min(3),
  lessonSlug: z.string().min(3),
  sourceCode: z.string().optional(),
  selectedChoiceKey: z.string().optional()
})

export type SubmissionPayload = z.infer<typeof submissionSchema>

type SubmissionResult = {
  status: number
  outcome: SubmissionOutcome
}

function createOutcome(
  status: string,
  feedback: string,
  options: Partial<SubmissionOutcome> & { configured?: boolean } = {}
): SubmissionOutcome {
  return {
    configured: options.configured ?? false,
    passed: options.passed ?? false,
    stdout: options.stdout ?? "",
    stderr: options.stderr ?? "",
    compileOutput: options.compileOutput ?? "",
    status,
    feedback
  }
}

function buildMultipleChoiceOutcome(
  challenge: Challenge,
  selectedChoiceKey: string | undefined
): SubmissionOutcome {
  if (!selectedChoiceKey) {
    return createOutcome("bad_request", "Choose an answer first.")
  }

  if (!challenge.choiceOptions.length || !challenge.correctChoiceKey) {
    return createOutcome("invalid_assignment", "This multiple-choice assignment is not configured yet.", {
      configured: true
    })
  }

  if (!challenge.choiceOptions.some((option) => option.key === selectedChoiceKey)) {
    return createOutcome("bad_request", "The selected answer choice is not available for this assignment.")
  }

  const passed = selectedChoiceKey === challenge.correctChoiceKey

  return createOutcome(passed ? "correct" : "incorrect", passed ? "Correct answer." : "That choice is not correct yet.", {
    configured: true,
    passed
  })
}

function shouldPersistReviewResult(outcome: SubmissionOutcome) {
  return outcome.configured && ![
    "bad_request",
    "invalid_assignment",
    "runner_error",
    "runner_not_configured",
    "runner_timeout",
    "local_lab_cli_required"
  ].includes(outcome.status)
}

/**
 * Builds the source Judge0 executes and keeps runner-specific plumbing hidden
 * behind one entry point. JavaScript checks receive `stackOutput` so hidden
 * tests can assert console output without re-executing user code.
 */
function indentCode(source: string, prefix: string) {
  return source
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join("\n")
}

function buildRunnerSource(language: NonNullable<Challenge["language"]>, sourceCode: string, hiddenTestCode: string) {
  if (language === "javascript" || language === "typescript") {
    return `const __stackDevOutput = []
const __stackDevConsoleLog = console.log.bind(console)
console.log = (...args) => {
  const line = args.map((value) => String(value)).join(" ")
  __stackDevOutput.push(line)
  __stackDevConsoleLog(...args)
}

${sourceCode}

const stackOutput = __stackDevOutput.join("\\n")
${hiddenTestCode}
console.log("${PASS_MARKER}")
`
  }

  if (language === "python") {
    return `import io
import sys

__stackDevRealStdout = sys.stdout
__stackDevStdoutBuffer = io.StringIO()

class __StackDevWriter(io.TextIOBase):
    def write(self, value):
        __stackDevStdoutBuffer.write(value)
        return __stackDevRealStdout.write(value)

    def flush(self):
        return __stackDevRealStdout.flush()

sys.stdout = __StackDevWriter()

${sourceCode}

sys.stdout = __stackDevRealStdout
stackOutput = __stackDevStdoutBuffer.getvalue()
${hiddenTestCode}
print("${PASS_MARKER}")
`
  }

  if (language === "go") {
    return `${sourceCode}

func init() {
${indentCode(hiddenTestCode, "\t")}
\tprintln("${PASS_MARKER}")
}
`
  }

  if (language === "sqlite") {
    return `${sourceCode}

${hiddenTestCode}

select '${PASS_MARKER}' as stack_dev_pass;
`
  }

  return `${sourceCode}

${hiddenTestCode}
print("${PASS_MARKER}")
`
}

function getJudge0BaseUrl() {
  return (process.env.JUDGE0_API_URL ?? "").replace(/\/+$/, "")
}

function getJudge0Headers() {
  return {
    "Content-Type": "application/json",
    ...(process.env.JUDGE0_API_KEY ? { "X-Auth-Token": process.env.JUDGE0_API_KEY } : {})
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractReadableFailure(rawOutput: string) {
  const lines = rawOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return ""
  }

  const explicitErrorLine = [...lines]
    .reverse()
    .find((line) => /\b(?:Assertion|Reference|Type|Range|Syntax|Eval|URI)?Error:|panic:|no such function:/i.test(line))

  if (explicitErrorLine) {
    if (/panic:/i.test(explicitErrorLine)) {
      return explicitErrorLine.replace(/^.*?panic:\s*/i, "")
    }

    if (/no such function:/i.test(explicitErrorLine)) {
      return explicitErrorLine.trim()
    }

    return explicitErrorLine.replace(/^.*?\b((?:Assertion|Reference|Type|Range|Syntax|Eval|URI)?Error:\s*)/, "")
  }

  return lines.at(-1) ?? ""
}

function buildOutcomeFromJudge0Payload(payload: Record<string, unknown>): SubmissionOutcome {
  const statusPayload = payload.status as Record<string, unknown> | string | undefined
  const stdout = String(payload.stdout ?? "")
  const rawStderr = String(payload.stderr ?? payload.message ?? "")
  const rawCompileOutput = String(payload.compile_output ?? "")
  const status =
    typeof statusPayload === "string"
      ? statusPayload
      : String(statusPayload?.description ?? "processed")
  const stderr = extractReadableFailure(rawStderr) || rawStderr
  const compileOutput = extractReadableFailure(rawCompileOutput) || rawCompileOutput
  const passed = stdout.includes(PASS_MARKER) && !rawStderr && !rawCompileOutput
  const failureFeedback = compileOutput || stderr || "The answer did not pass yet."

  return createOutcome(status, passed ? "All checks passed." : failureFeedback, {
    configured: true,
    passed,
    stdout: stdout.replace(PASS_MARKER, "").trim(),
    stderr,
    compileOutput
  })
}

async function runJudge0Submission(
  language: NonNullable<Challenge["language"]>,
  judge0LanguageId: number,
  sourceCode: string,
  hiddenTestCode: string
): Promise<SubmissionOutcome> {
  if (!hasJudge0Env()) {
    return createOutcome("runner_not_configured", "Answer checking is not configured yet for this project.")
  }

  const response = await fetch(`${getJudge0BaseUrl()}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: getJudge0Headers(),
    body: JSON.stringify({
      language_id: judge0LanguageId,
      source_code: buildRunnerSource(language, sourceCode, hiddenTestCode),
      cpu_time_limit: 2,
      memory_limit: 128000
    })
  })

  if (!response.ok) {
    return createOutcome("runner_error", `Answer checking failed with status ${response.status}.`, {
      configured: true
    })
  }

  const creationPayload = (await response.json()) as Record<string, unknown>
  const token = String(creationPayload.token ?? "")

  if (!token) {
    return createOutcome("runner_error", "Answer checking did not return a submission token.", {
      configured: true
    })
  }

  for (let attempt = 0; attempt < JUDGE0_POLL_ATTEMPTS; attempt += 1) {
    const resultResponse = await fetch(`${getJudge0BaseUrl()}/submissions/${token}?base64_encoded=false`, {
      headers: getJudge0Headers()
    })

    if (!resultResponse.ok) {
      return createOutcome("runner_error", `Answer checking failed while polling result ${resultResponse.status}.`, {
        configured: true
      })
    }

    const latestPayload = (await resultResponse.json()) as Record<string, unknown>
    const status = latestPayload.status as Record<string, unknown> | undefined
    const statusId = Number(status?.id ?? 0)

    if (!PROCESSING_STATUS_IDS.has(statusId)) {
      return buildOutcomeFromJudge0Payload(latestPayload)
    }

    await delay(JUDGE0_POLL_DELAY_MS)
  }

  return createOutcome("runner_timeout", "Answer checking timed out before a result was ready.", {
    configured: true
  })
}

async function persistSubmissionOutcome(payload: SubmissionPayload, challenge: Challenge, outcome: SubmissionOutcome) {
  if (!hasSupabaseEnv()) {
    return
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } }

  if (!user) {
    return
  }

  const [{ data: courseRow }] = await Promise.all([
    supabase!.from("courses").select("id").eq("slug", payload.courseSlug).maybeSingle()
  ])

  const { data: lessonRow } = await supabase!
    .from("lessons")
    .select("id")
    .eq("course_id", courseRow?.id ?? "")
    .eq("slug", payload.lessonSlug)
    .maybeSingle()

  const { data: submissionRow } = await supabase!
    .from("submissions")
    .insert({
      user_id: user.id,
      challenge_id: challenge.id,
      challenge_version_id: challenge.versionId,
      source_code: payload.sourceCode ?? payload.selectedChoiceKey ?? "",
      status: outcome.status,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      compile_output: outcome.compileOutput,
      passed: outcome.passed
    })
    .select("id")
    .single()

  if (submissionRow?.id && shouldPersistReviewResult(outcome)) {
    await saveChallengeReviewResult(supabase!, {
      userId: user.id,
      challengeId: challenge.id,
      submissionId: String(submissionRow.id),
      result: outcome.passed ? "passed" : "failed"
    })
  }

  if (lessonRow?.id) {
    const { data: existingProgress } = await supabase!
      .from("lesson_progress")
      .select("status, completed_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonRow.id)
      .maybeSingle()

    const alreadyCompleted = existingProgress?.status === "completed"

    await supabase!.from("lesson_progress").upsert(
      {
        user_id: user.id,
        lesson_id: lessonRow.id,
        last_submission_id: submissionRow?.id ?? null,
        status: alreadyCompleted || outcome.passed ? "completed" : "in_progress",
        completed_at: alreadyCompleted ? existingProgress?.completed_at : outcome.passed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,lesson_id"
      }
    )
  }

  await saveResumeStateForUser(supabase!, user.id, {
    courseSlug: payload.courseSlug,
    lessonSlug: payload.lessonSlug
  })
}

/**
 * Executes a learner submission and persists any authenticated progress updates.
 */
export async function submitChallenge(payload: SubmissionPayload): Promise<SubmissionResult> {
  const challenge = await getRunnerChallengeBySlug(payload.challengeSlug)

  if (!challenge) {
    return {
      status: 404,
      outcome: createOutcome("missing_challenge", "Challenge not found.")
    }
  }

  const outcome =
    challenge.kind === "multiple_choice"
      ? buildMultipleChoiceOutcome(challenge, payload.selectedChoiceKey)
      : challenge.kind === "local_lab"
        ? createOutcome(
            "local_lab_cli_required",
            "This assignment is completed through the local CLI workflow, not the in-browser runner.",
            { configured: true }
          )
      : !payload.sourceCode
        ? createOutcome("bad_request", "Write an answer before running the checker.")
        : await runJudge0Submission(
            challenge.language ?? "javascript",
            challenge.judge0LanguageId ?? 102,
            payload.sourceCode,
            challenge.hiddenTestCode
          )

  await persistSubmissionOutcome(payload, challenge, outcome)

  return {
    status: 200,
    outcome
  }
}

export function buildInvalidSubmissionOutcome(message: string): SubmissionOutcome {
  return createOutcome("bad_request", message)
}
