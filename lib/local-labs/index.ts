import type { Challenge } from "@/lib/types"

export type LocalLabCheck = {
  id: string
  title: string
  command: string
  expectedExitCode: number
  expectedStdoutIncludes: string[]
  expectedStderrIncludes: string[]
}

export type LocalLabManifest = {
  version: 1
  runner: "stack_cli"
  setupSteps: string[]
  checks: LocalLabCheck[]
}

export type LocalLabDefinition = {
  commandTemplate: string
  solutionNotes: string
  manifestSource: string
  manifest: LocalLabManifest | null
  manifestError: string | null
}

type LocalLabManifestParseResult =
  | {
      success: true
      manifest: LocalLabManifest
    }
  | {
      success: false
      message: string
    }

type LocalLabCheckParseResult =
  | {
      success: true
      check: LocalLabCheck
    }
  | {
      success: false
      message: string
    }

const DEFAULT_LOCAL_LAB_COMMAND_TEMPLATE = "stack local-lab submit {{challenge_slug}}"

const DEFAULT_LOCAL_LAB_MANIFEST: LocalLabManifest = {
  version: 1,
  runner: "stack_cli",
  setupSteps: [
    "Install the Stack CLI if you have not already.",
    "Authenticate with `stack login` before running the lab submission command."
  ],
  checks: [
    {
      id: "smoke-check",
      title: "Smoke check",
      command: "echo \"it works on my machine\"",
      expectedExitCode: 0,
      expectedStdoutIncludes: ["it works on my machine"],
      expectedStderrIncludes: []
    }
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeStringArray(value: unknown, fieldLabel: string) {
  if (value == null) {
    return { success: true as const, values: [] }
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return {
      success: false as const,
      message: `${fieldLabel} must be an array of strings.`
    }
  }

  return {
    success: true as const,
    values: value.map((entry) => entry.trim()).filter(Boolean)
  }
}

function parseCheck(value: unknown, index: number): LocalLabCheckParseResult {
  if (!isRecord(value)) {
    return {
      success: false,
      message: `Check ${index + 1} must be an object.`
    }
  }

  const title = String(value.title ?? "").trim()
  const command = String(value.command ?? "").trim()
  const id = String(value.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-+|-+$/g, "")
  const expectedExitCode = Number(value.expectedExitCode ?? 0)
  const stdoutIncludes = normalizeStringArray(value.expectedStdoutIncludes, `Check ${index + 1} stdout matcher`)
  const stderrIncludes = normalizeStringArray(value.expectedStderrIncludes, `Check ${index + 1} stderr matcher`)

  if (!title) {
    return {
      success: false,
      message: `Check ${index + 1} needs a title.`
    }
  }

  if (!command) {
    return {
      success: false,
      message: `Check ${index + 1} needs a command.`
    }
  }

  if (!id) {
    return {
      success: false,
      message: `Check ${index + 1} needs an id or a title that can be turned into one.`
    }
  }

  if (!Number.isInteger(expectedExitCode) || expectedExitCode < 0) {
    return {
      success: false,
      message: `Check ${index + 1} exit code must be a non-negative integer.`
    }
  }

  if (!stdoutIncludes.success) {
    return {
      success: false,
      message: stdoutIncludes.message
    }
  }

  if (!stderrIncludes.success) {
    return {
      success: false,
      message: stderrIncludes.message
    }
  }

  return {
    success: true,
    check: {
      id,
      title,
      command,
      expectedExitCode,
      expectedStdoutIncludes: stdoutIncludes.values,
      expectedStderrIncludes: stderrIncludes.values
    }
  }
}

/**
 * Provides a stable starter command so authoring and learner surfaces do not
 * need to know how local-lab submissions will eventually be signed or routed.
 */
export function buildDefaultLocalLabCommandTemplate() {
  return DEFAULT_LOCAL_LAB_COMMAND_TEMPLATE
}

/**
 * Provides a single starter manifest shape that can grow over time without
 * forcing every authoring surface to understand the underlying JSON contract.
 */
export function buildDefaultLocalLabManifestSource() {
  return JSON.stringify(DEFAULT_LOCAL_LAB_MANIFEST, null, 2)
}

/**
 * Validates the author-provided manifest and returns a normalized object that
 * both admin validation and learner rendering can share.
 */
export function parseLocalLabManifestSource(source: string): LocalLabManifestParseResult {
  const trimmedSource = source.trim()
  if (!trimmedSource) {
    return {
      success: false,
      message: "Local lab manifest JSON is required."
    }
  }

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(trimmedSource)
  } catch {
    return {
      success: false,
      message: "Local lab manifest must be valid JSON."
    }
  }

  if (!isRecord(parsedValue)) {
    return {
      success: false,
      message: "Local lab manifest must be a JSON object."
    }
  }

  const version = Number(parsedValue.version ?? 0)
  if (version !== 1) {
    return {
      success: false,
      message: "Local lab manifest version must currently be 1."
    }
  }

  const runner = String(parsedValue.runner ?? "")
  if (runner !== "stack_cli") {
    return {
      success: false,
      message: "Local lab manifest runner must currently be `stack_cli`."
    }
  }

  const setupStepsResult = normalizeStringArray(parsedValue.setupSteps, "Local lab setup steps")
  if (!setupStepsResult.success) {
    return {
      success: false,
      message: setupStepsResult.message
    }
  }

  if (!Array.isArray(parsedValue.checks) || parsedValue.checks.length === 0) {
    return {
      success: false,
      message: "Local lab manifest needs at least one check."
    }
  }

  const checks: LocalLabCheck[] = []
  for (const [index, entry] of parsedValue.checks.entries()) {
    const parsedCheck = parseCheck(entry, index)
    if (!parsedCheck.success) {
      return parsedCheck
    }

    checks.push(parsedCheck.check)
  }

  return {
    success: true,
    manifest: {
      version: 1,
      runner: "stack_cli",
      setupSteps: setupStepsResult.values,
      checks
    }
  }
}

/**
 * Hides the current challenge-column reuse behind a lab-specific view model so
 * future schema changes can stay inside this module.
 */
export function getLocalLabDefinition(
  challenge: Pick<Challenge, "starterCode" | "solutionCode" | "hiddenTestCode">
): LocalLabDefinition {
  const commandTemplate = challenge.starterCode.trim() || buildDefaultLocalLabCommandTemplate()
  const solutionNotes = challenge.solutionCode.trim()
  const manifestSource = challenge.hiddenTestCode.trim() || buildDefaultLocalLabManifestSource()
  const parsedManifest = parseLocalLabManifestSource(manifestSource)

  return {
    commandTemplate,
    solutionNotes,
    manifestSource,
    manifest: parsedManifest.success ? parsedManifest.manifest : null,
    manifestError: parsedManifest.success ? null : parsedManifest.message
  }
}
