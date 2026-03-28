# Code Checker Implementation

## Goal

Provide a reliable code-checking pipeline for learner assignments while keeping the learner UI simple and the runner-specific complexity hidden behind deeper modules.

## Current State

The app already has a working code checker for:

- JavaScript
- Python

Current runtime flow:

1. The learner submits code from the workbench.
2. The request hits [`/api/submissions`](C:/Users/garre/boot.dev/app/api/submissions/route.ts).
3. The route delegates to [`lib/submissions`](C:/Users/garre/boot.dev/lib/submissions/index.ts).
4. The submission service:
   - loads the authored challenge
   - builds runner source
   - sends it to Judge0
   - polls for the result
   - extracts readable errors
   - persists submission and lesson progress

Language defaults currently implemented in [`lib/judge0/languages.ts`](C:/Users/garre/boot.dev/lib/judge0/languages.ts):

- Python: `71`
- JavaScript: `102`

## What Already Works

### JavaScript

- editable learner source file
- read-only hidden test file
- runner support for `console.log`
- hidden tests can assert `stackOutput`
- pass/fail and readable runtime errors

### Python

- editable learner source file
- read-only hidden test file
- hidden assertions
- pass/fail and readable runtime errors

## What Is Not Implemented Yet

### TypeScript

TypeScript is not fully wired yet.

To support it safely, we need to add it across the full checker boundary, not just the admin form.

## Recommended TypeScript Rollout

### 1. Extend the challenge language model

Update [`lib/types.ts`](C:/Users/garre/boot.dev/lib/types.ts):

- add `"typescript"` to `Challenge["language"]`

### 2. Add Judge0 language mapping

Update [`lib/judge0/languages.ts`](C:/Users/garre/boot.dev/lib/judge0/languages.ts):

- add a default Judge0 language id for TypeScript

Important:
- confirm the exact TypeScript language id from the Judge0 host you are using
- do not guess and hard-code it without verifying the provider

### 3. Update authoring defaults

Update [`components/admin/authoring-form.tsx`](C:/Users/garre/boot.dev/components/admin/authoring-form.tsx):

- allow `typescript` in the language picker
- generate starter code template
- generate solution template
- generate hidden test template

### 4. Update file naming in the learner workbench

Update [`components/code/challenge-workbench.tsx`](C:/Users/garre/boot.dev/components/code/challenge-workbench.tsx):

- source file label should become `main.ts`
- hidden tests file label should become `main_test.ts`
- solution file label should become `solution.ts`

### 5. Extend runner source generation

Update [`lib/submissions/index.ts`](C:/Users/garre/boot.dev/lib/submissions/index.ts):

- treat TypeScript separately from plain JavaScript
- decide whether the Judge0 host executes TypeScript directly or transpiles it internally
- preserve `stackOutput` support so hidden tests can still validate console output

### 6. Keep readable error extraction

The current readable-error path in [`lib/submissions/index.ts`](C:/Users/garre/boot.dev/lib/submissions/index.ts) should stay shared across:

- Python
- JavaScript
- TypeScript

That keeps the learner-facing interface simple even if the runtime differences grow.

## Hidden Test Model

The current checker model is:

- learner sees the prompt
- learner writes code in `main.*`
- learner may inspect `main_test.*` if you allow that UI
- authored hidden checks live in `hidden_test_code`
- the service builds one combined runner payload

Current JavaScript runner behavior:

- captures `console.log`
- exposes the captured output as `stackOutput`
- appends the pass marker only after hidden tests succeed

Current Python runner behavior:

- executes learner source
- runs hidden assertions
- prints the pass marker if tests succeed

## Error Model

The learner should see:

- pass/fail
- readable failure message
- standard output
- compile output when relevant
- runtime errors when relevant

This already exists in [`lib/submissions/index.ts`](C:/Users/garre/boot.dev/lib/submissions/index.ts) and should remain the single place that translates Judge0 responses into learner-facing outcomes.

## Database Model

The checker currently stores results in:

- `submissions`
- `lesson_progress`
- `resume_state`

No checker-specific schema change is required for TypeScript if the existing `challenges.language` and `judge0_language_id` values can represent it cleanly.

## Recommended Build Order

1. Keep JavaScript and Python stable.
2. Verify the Judge0 TypeScript language id from the current provider.
3. Add TypeScript to the domain types.
4. Add TypeScript to admin authoring.
5. Add TypeScript file labels and runner source generation.
6. Add one TypeScript lesson and one TypeScript assignment.
7. Verify:
   - passing submission
   - wrong answer
   - runtime error
   - compile error

## Acceptance Criteria

TypeScript support is ready when:

- an author can create a TypeScript assignment in admin
- the learner sees `main.ts` and `main_test.ts`
- `Submit` and `Run` return correct pass/fail results
- compile errors are readable
- runtime errors are readable
- completed submissions still update progress normally

## Design Notes

To stay aligned with `AGENTS.md`:

- keep Judge0 details inside [`lib/submissions`](C:/Users/garre/boot.dev/lib/submissions/index.ts)
- keep admin language defaults inside the authoring form and language map
- avoid pushing runner-specific conditionals into page components
- keep the learner-facing submission API simple

