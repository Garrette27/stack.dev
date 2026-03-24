import { NextResponse } from "next/server"

import { buildInvalidSubmissionOutcome, submissionSchema, submitChallenge } from "@/lib/submissions"

export async function POST(request: Request) {
  let json: unknown

  try {
    json = await request.json()
  } catch {
    return NextResponse.json(buildInvalidSubmissionOutcome("Invalid submission payload."), { status: 400 })
  }

  const parsed = submissionSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(buildInvalidSubmissionOutcome(parsed.error.issues[0]?.message ?? "Invalid submission payload."), {
      status: 400
    })
  }

  const result = await submitChallenge(parsed.data)
  return NextResponse.json(result.outcome, { status: result.status })
}
