# Local Lab Implementation

## Goal

Add a long-term `local_lab` challenge type for lessons that must run on the
learner's machine instead of inside the browser runner.

This is the right fit for courses such as:

- Git
- Linux
- Docker
- Kubernetes
- CI/CD
- file-system lessons
- local tooling setup

## Product Shape

`local_lab` should feel like a first-class challenge kind, not a special case
hidden inside code assignments.

The learner flow is:

1. read the lesson and assignment on the website
2. copy the CLI submit command
3. complete the work locally
4. let the CLI run the lab manifest checks
5. send the result back to the app

## Current Foundation In The App

The app now includes:

- a real `local_lab` challenge kind
- admin authoring for local labs
- learner rendering for local labs
- a deep manifest module in [lib/local-labs/index.ts](C:/Users/garre/boot.dev/lib/local-labs/index.ts)
- browser submissions explicitly rejected in [lib/submissions/index.ts](C:/Users/garre/boot.dev/lib/submissions/index.ts)

This keeps the app ready for the CLI integration without pretending the browser
runner can execute local-machine lessons.

## Why This Design Follows AGENTS.md

- The CLI contract lives in one deep module instead of being reconstructed in
  page components.
- The app treats `local_lab` as a distinct abstraction, not as “code, but with
  weird rules”.
- The current storage reuse is hidden inside the local-lab module so future
  schema changes stay localized.
- Browser pages stay thin: they render a prepared lab definition instead of
  parsing raw manifest JSON themselves.

## Current Storage Mapping

Right now `local_lab` reuses the existing challenge content columns:

- `starter_code`: CLI submit command template
- `solution_code`: author-only solution notes
- `hidden_test_code`: lab manifest JSON

That reuse is intentionally hidden behind [lib/local-labs/index.ts](C:/Users/garre/boot.dev/lib/local-labs/index.ts).

If we later introduce dedicated database columns or tables, only that module
and the admin save path should need to change.

## Manifest Contract

Current manifest shape:

```json
{
  "version": 1,
  "runner": "stack_cli",
  "setupSteps": [
    "Install the Stack CLI if you have not already."
  ],
  "checks": [
    {
      "id": "smoke-check",
      "title": "Smoke check",
      "command": "echo \"it works on my machine\"",
      "expectedExitCode": 0,
      "expectedStdoutIncludes": ["it works on my machine"],
      "expectedStderrIncludes": []
    }
  ]
}
```

Current responsibilities:

- `setupSteps`: displayed to learners before they run the lab
- `checks`: what the CLI should execute and validate locally
- `runner`: locks the manifest to the expected CLI runtime
- `version`: keeps future manifest upgrades explicit

## Recommended CLI Architecture

Long term, the CLI should not trust the lesson page directly. It should request
a signed session payload first.

Recommended flow:

1. learner opens a `local_lab` assignment on the website
2. learner copies or launches a CLI command template
3. CLI requests a signed lab session from the app
4. app returns:
   - challenge id
   - challenge version id
   - signed manifest
   - submission token or session token
   - expiration
5. CLI runs checks locally
6. CLI posts normalized results back to the app
7. app stores the submission and updates lesson progress/review state

## Recommended Future Endpoints

### 1. Start Local Lab Session

Suggested route:

- `POST /api/local-labs/session`

Input:

- `challengeSlug`
- authenticated user context

Output:

- `challengeId`
- `challengeVersionId`
- `sessionToken`
- `expiresAt`
- `commandTemplate`
- `manifest`

Responsibilities:

- ensure the challenge is a published `local_lab`
- bind the session to the authenticated learner
- sign the manifest so the CLI can detect tampering

### 2. Submit Local Lab Result

Suggested route:

- `POST /api/local-labs/submissions`

Input:

- `sessionToken`
- normalized check results
- overall pass/fail
- captured stdout/stderr summary

Output:

- normalized submission outcome
- updated completion state

Responsibilities:

- verify session token
- verify challenge version
- store submission row
- update progress
- update spaced-review state

## Result Normalization

Local labs should normalize into the same top-level result model used by the
rest of the platform:

- `passed`
- `status`
- `feedback`
- `stdout`
- `stderr`
- `compileOutput`

For `local_lab`, `compileOutput` will usually remain empty, but the shared
shape matters because:

- lesson progress should not care where the result came from
- review scheduling should not care whether the assignment was browser-run or
  CLI-run
- analytics should be able to compare challenge types consistently

## Recommended Status Values

Add local-lab-specific statuses later as needed:

- `local_lab_passed`
- `local_lab_failed`
- `local_lab_setup_error`
- `local_lab_session_expired`
- `local_lab_submission_rejected`

These should still map cleanly into the shared learner result cards.

## Security Notes

The CLI workflow should assume the learner machine is untrusted.

That means:

- never trust raw learner-reported pass/fail without a signed session
- bind manifests to a specific challenge version
- expire session tokens quickly
- keep the manifest signature server-generated
- reject submissions for archived or draft challenge versions

## Recommended Database Follow-Up

The current storage reuse is acceptable for bootstrapping, but the cleaner
long-term design is to add dedicated lab tables.

Recommended later additions:

- `local_lab_manifests`
- `local_lab_sessions`
- `local_lab_submission_results`

That future split would let us:

- track signed sessions separately from authored content
- keep raw CLI telemetry out of the core `challenges` table
- version manifests independently when needed

## Rollout Order

1. Keep the current `local_lab` challenge kind in the app.
2. Build the CLI session endpoint.
3. Build the CLI submission endpoint.
4. Add signed manifest support.
5. Persist local-lab completions into normal progress and review state.
6. Introduce dedicated lab tables only if the reused columns start to feel
   shallow or leaky.

## Non-Goals For This Phase

This phase should not try to:

- execute local commands from the browser
- simulate Docker or shell work inside Judge0
- invent a second progress system just for labs
- expose manifest parsing details in page components

## Summary

`local_lab` is the long-term foundation for Boot.dev-style machine-based
lessons. The app now has the correct content abstraction for it. The next major
step is CLI session signing and synced submission storage, not more browser-side
special cases.
