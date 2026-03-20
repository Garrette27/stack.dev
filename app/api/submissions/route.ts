import { NextResponse } from "next/server"
import { z } from "zod"

import { getRunnerChallengeBySlug } from "@/lib/data"
import { hasJudge0Env, hasSupabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import type { SubmissionOutcome } from "@/lib/types"

const PASS_MARKER = "__STACK_DEV_PH_PASS__"
const PROCESSING_STATUS_IDS = new Set([1, 2])
const JUDGE0_POLL_ATTEMPTS = 20
const JUDGE0_POLL_DELAY_MS = 400

const submissionSchema = z.object({
  challengeSlug: z.string().min(3),
  courseSlug: z.string().min(3),
  lessonSlug: z.string().min(3),
  sourceCode: z.string().min(1)
})

function buildRunnerSource(language: "python" | "javascript", sourceCode: string, hiddenTestCode: string) {
  if (language === "javascript") {
    return `${sourceCode}

${hiddenTestCode}
console.log("${PASS_MARKER}")
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

function buildOutcomeFromJudge0Payload(payload: Record<string, unknown>): SubmissionOutcome {
  const statusPayload = payload.status as Record<string, unknown> | string | undefined
  const stdout = String(payload.stdout ?? "")
  const stderr = String(payload.stderr ?? payload.message ?? "")
  const compileOutput = String(payload.compile_output ?? "")
  const status =
    typeof statusPayload === "string"
      ? statusPayload
      : String(statusPayload?.description ?? "processed")
  const passed = stdout.includes(PASS_MARKER) && !stderr && !compileOutput

  return {
    configured: true,
    passed,
    stdout: stdout.replace(PASS_MARKER, "").trim(),
    stderr,
    compileOutput,
    status,
    feedback: passed ? "All hidden checks passed." : "The hidden checks did not pass yet."
  }
}

async function runJudge0Submission(
  language: "python" | "javascript",
  judge0LanguageId: number,
  sourceCode: string,
  hiddenTestCode: string
): Promise<SubmissionOutcome> {
  if (!hasJudge0Env()) {
    return {
      configured: false,
      passed: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "runner_not_configured",
      feedback: "Judge0 is not configured yet. The learner flow is ready, but code checking is still in preview mode."
    }
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
    return {
      configured: true,
      passed: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "runner_error",
      feedback: `Judge0 request failed with status ${response.status}.`
    }
  }

  const creationPayload = (await response.json()) as Record<string, unknown>
  const token = String(creationPayload.token ?? "")

  if (!token) {
    return {
      configured: true,
      passed: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "runner_error",
      feedback: "Judge0 did not return a submission token."
    }
  }

  for (let attempt = 0; attempt < JUDGE0_POLL_ATTEMPTS; attempt += 1) {
    const resultResponse = await fetch(`${getJudge0BaseUrl()}/submissions/${token}?base64_encoded=false`, {
      headers: getJudge0Headers()
    })

    if (!resultResponse.ok) {
      return {
        configured: true,
        passed: false,
        stdout: "",
        stderr: "",
        compileOutput: "",
        status: "runner_error",
        feedback: `Judge0 result polling failed with status ${resultResponse.status}.`
      }
    }

    const latestPayload = (await resultResponse.json()) as Record<string, unknown>
    const status = latestPayload.status as Record<string, unknown> | undefined
    const statusId = Number(status?.id ?? 0)

    if (!PROCESSING_STATUS_IDS.has(statusId)) {
      return buildOutcomeFromJudge0Payload(latestPayload)
    }

    await delay(JUDGE0_POLL_DELAY_MS)
  }

  return {
    configured: true,
    passed: false,
    stdout: "",
    stderr: "",
    compileOutput: "",
    status: "runner_timeout",
    feedback: "Judge0 did not finish processing before the polling timeout."
  }
}

export async function POST(request: Request) {
  const json = await request.json()
  const parsed = submissionSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json<SubmissionOutcome>(
      {
        configured: false,
        passed: false,
        stdout: "",
        stderr: "",
        compileOutput: "",
        status: "bad_request",
        feedback: parsed.error.issues[0]?.message ?? "Invalid submission payload."
      },
      { status: 400 }
    )
  }

  const challenge = await getRunnerChallengeBySlug(parsed.data.challengeSlug)
  if (!challenge) {
    return NextResponse.json<SubmissionOutcome>(
      {
        configured: false,
        passed: false,
        stdout: "",
        stderr: "",
        compileOutput: "",
        status: "missing_challenge",
        feedback: "Challenge not found."
      },
      { status: 404 }
    )
  }

  const outcome = await runJudge0Submission(
    challenge.language,
    challenge.judge0LanguageId,
    parsed.data.sourceCode,
    challenge.hiddenTestCode
  )

  if (hasSupabaseEnv()) {
    const supabase = await createClient()
    const {
      data: { user }
    } = (await supabase?.auth.getUser()) ?? { data: { user: null } }

    if (user) {
      const { data: courseRow } = await supabase!
        .from("courses")
        .select("id")
        .eq("slug", parsed.data.courseSlug)
        .maybeSingle()

      const { data: lessonRow } = await supabase!
        .from("lessons")
        .select("id")
        .eq("course_id", courseRow?.id ?? "")
        .eq("slug", parsed.data.lessonSlug)
        .maybeSingle()

      const { data: challengeRow } = await supabase!
        .from("challenges")
        .select("id")
        .eq("slug", parsed.data.challengeSlug)
        .maybeSingle()

      const { data: submissionRow } = await supabase!
        .from("submissions")
        .insert({
          user_id: user.id,
          challenge_id: challengeRow?.id ?? null,
          source_code: parsed.data.sourceCode,
          status: outcome.status,
          stdout: outcome.stdout,
          stderr: outcome.stderr,
          compile_output: outcome.compileOutput,
          passed: outcome.passed
        })
        .select("id")
        .single()

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
            completed_at:
              alreadyCompleted
                ? existingProgress?.completed_at
                : outcome.passed
                  ? new Date().toISOString()
                  : null,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "user_id,lesson_id"
          }
        )
      }

      await supabase!.from("resume_state").upsert(
        {
          user_id: user.id,
          course_slug: parsed.data.courseSlug,
          lesson_slug: parsed.data.lessonSlug,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "user_id"
        }
      )
    }
  }

  return NextResponse.json(outcome)
}
