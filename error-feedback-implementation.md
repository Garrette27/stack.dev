# Error Feedback Implementation

## Goal

Improve learner-facing checker results so the result panel can answer three
different questions clearly:

1. did the learner's code fail to run?
2. did the learner's code run, but fail a checker expectation?
3. did the checker infrastructure fail?

The current pipeline already runs code and stores `stdout`, `stderr`,
`compile_output`, and a `feedback` string. The missing piece is a deeper,
language-aware failure model that can normalize JavaScript, TypeScript, SQLite,
Python, C, and future Java behavior behind one small interface.

This plan follows `AGENTS.md` by:

- keeping language-specific parsing in one server-only module
- keeping page components free of runner details
- distinguishing authoring concerns from runner concerns
- preferring one deep normalization layer over many UI conditionals

## Current Problem

Today, checker failures and learner runtime failures are too easy to mix
together.

Example:

- learner leaves `console.log("hello there!")`
- hidden tests throw `new Error("Print the expected text")`
- learner sees `Runtime Error (NZEC)` and `Print the expected text`

That message is useful, but the category is misleading. It is not really a
learner runtime crash. It is a checker assertion failure.

The app should distinguish:

- `compile_error`
- `runtime_error`
- `checker_failed`
- `checker_compile_error`
- `infrastructure_error`

## Recommended Architecture

Add one deeper server-only module:

- `lib/submissions/error-feedback.ts`

That module should own:

- per-language error extraction
- sentinel parsing
- failure categorization
- learner-safe summaries
- optional line / column extraction

Keep these responsibilities where they already belong:

- `lib/submissions/index.ts`
  - runner submission orchestration
  - persistence
  - progress updates
- `lib/judge0/languages.ts`
  - language ids
  - authoring defaults
  - runnable language metadata
- `app/api/submissions/route.ts`
  - request validation only

## Normalized Failure Shape

Add one normalized type:

```ts
export type LearnerFailureKind =
  | "checker_failed"
  | "compile_error"
  | "runtime_error"
  | "infrastructure_error"

export type LearnerFailurePhase =
  | "compile"
  | "execute"
  | "assert"
  | "infrastructure"

export type LearnerFailure = {
  kind: LearnerFailureKind
  phase: LearnerFailurePhase
  language: string
  summary: string
  detail: string
  line: number | null
  column: number | null
  raw: string
}
```

Then change `SubmissionOutcome` to optionally include:

```ts
failure: LearnerFailure | null
```

The learner page should render the normalized `failure` first and only fall
back to `stderr` / `compileOutput` / `feedback` when `failure` is null.

## Sentinel Strategy

The cleanest long-term design is to reserve sentinel prefixes that only the
checker emits.

Recommended sentinels:

- `__STACK_CHECK_FAILED__`
- `__STACK_RUNTIME_FAILED__`
- `__STACK_COMPILE_FAILED__`

The normalization layer should strip these prefixes before the learner sees the
message.

### Why sentinels help

Without sentinels, the parser has to guess:

- did `TypeError` come from learner code?
- did `Error: expected ...` come from hidden tests?
- did SQL fail because the learner query is wrong or because the checker query
  rejected the result?

With sentinels, the parser does less guessing and the interface stays simpler.

## Language-by-Language Plan

### JavaScript

Runner strategy:

1. capture `console.log` into `stackOutput`
2. run learner code in one `try` block
3. run hidden tests in a second `try` block
4. prefix checker-thrown failures with `__STACK_CHECK_FAILED__`
5. prefix learner runtime crashes with `__STACK_RUNTIME_FAILED__`

Recommended wrapper shape:

```js
try {
  // learner code
} catch (error) {
  console.error(`__STACK_RUNTIME_FAILED__:${error?.message ?? String(error)}`)
  throw error
}

try {
  // hidden tests
} catch (error) {
  console.error(`__STACK_CHECK_FAILED__:${error?.message ?? String(error)}`)
  throw error
}
```

Parser behavior:

- if `stderr` contains `__STACK_CHECK_FAILED__`, return `checker_failed`
- if `stderr` contains `__STACK_RUNTIME_FAILED__`, return `runtime_error`
- extract line numbers from Node stack traces when available

### TypeScript

TypeScript should follow the same runtime strategy as JavaScript, with one
extra compile step in parsing.

Compile parsing:

- parse `compile_output`
- classify TypeScript compiler diagnostics as `compile_error`
- extract:
  - file
  - line
  - column
  - diagnostic message

Runner strategy:

- identical sentinel flow to JavaScript after compile succeeds

UI behavior:

- show compiler errors as `TypeScript compile error`
- show hidden-test failures as `Checker says this answer still fails`

### Python

Runner strategy:

1. mirror stdout into `stackOutput`
2. run learner code in one `try` block
3. run hidden tests in one second `try` block
4. print sentinel-prefixed messages before re-raising

Recommended wrapper shape:

```python
try:
    # learner code
except Exception as error:
    print(f"__STACK_RUNTIME_FAILED__:{error}", file=sys.stderr)
    raise

try:
    # hidden tests
except AssertionError as error:
    print(f"__STACK_CHECK_FAILED__:{error}", file=sys.stderr)
    raise
except Exception as error:
    print(f"__STACK_CHECK_FAILED__:{error}", file=sys.stderr)
    raise
```

Parser behavior:

- prefer checker sentinel over generic traceback tail
- extract traceback line numbers when possible
- classify raw `SyntaxError` as `compile_error` only if Judge0 reports it before
  execution begins; otherwise treat it as `runtime_error`

### SQLite

SQLite needs a different design because there is no normal exception model like
JavaScript or Python.

Do not rely on generic errors like:

- `no such function: missing_expected_output`

That makes the learner message shallow and fragile.

Recommended long-term strategy:

1. let learner SQL run first
2. let hidden tests emit sentinel result rows
3. have the normalization layer read stdout and look for those sentinel rows

Recommended hidden-test contract:

```sql
select '__STACK_CHECK_FAILED__|Print the expected text'
where not exists (
  select 1
  from (
    -- checker query here
  )
);
```

Then append the pass marker only if there are no checker sentinel rows.

Parser behavior:

- if stdout contains `__STACK_CHECK_FAILED__|...`, classify as `checker_failed`
- if stderr contains SQLite parser errors, classify as `compile_error`
- if execution fails because of table/column mistakes, classify as
  `runtime_error`

This gives SQLite a clean authoring contract without inventing fake SQL
exceptions.

### C

C should follow the same high-level model as Java:

1. compile learner code first
2. distinguish compiler diagnostics from runtime crashes
3. give hidden tests a stable checker-failure path
4. normalize line-aware messages from `gcc` or `clang`

Recommended contract:

- start with single-file authored exercises
- compile to one entry program
- let hidden tests fail through a sentinel-prefixed assertion helper

Recommended checker helper style:

```c
fprintf(stderr, "__STACK_CHECK_FAILED__:Expected output was missing\n");
exit(1);
```

If you later support multi-file C projects, keep that complexity below one
server-only runner adapter instead of exposing file-assembly rules in pages.

Parser behavior:

- `error:` diagnostics from compiler output -> `compile_error`
- `warning:` lines should not fail the submission by themselves
- segmentation faults / aborts / non-zero runtime exits -> `runtime_error`
- sentinel-prefixed hidden-test failures -> `checker_failed`
- extract `file:line:column` when available

### Java

Java is not exposed in authoring yet, but the error model should be designed now
so the later language launch does not force another redesign.

Recommended Java contract:

1. compile one learner-owned `Main.java`
2. wrap checker assertions in a separate helper or in guarded code after
   learner execution
3. prefix checker assertion failures with `__STACK_CHECK_FAILED__`
4. prefix learner exceptions with `__STACK_RUNTIME_FAILED__`

Recommended hidden-test style:

```java
throw new AssertionError("Expected the welcome message to stay unchanged");
```

Parser behavior:

- `javac` diagnostics -> `compile_error`
- `AssertionError` with checker sentinel -> `checker_failed`
- uncaught learner exceptions -> `runtime_error`
- extract line numbers from `Main.java:line` stack traces

## Immediate Refactor Plan

### Phase 1: Normalize failures without changing the UI yet

Add:

- `lib/submissions/error-feedback.ts`

Functions:

- `normalizeSubmissionFailure(language, payload): LearnerFailure | null`
- `buildSubmissionFeedback(outcome, failure): string`

Then update:

- `lib/submissions/index.ts`

So `buildOutcomeFromJudge0Payload` delegates parsing instead of guessing inside
that file.

### Phase 2: Split learner code from checker code in runner wrappers

Update `buildRunnerSource` for:

- JavaScript
- TypeScript
- Python

Then design the SQL sentinel-row contract for SQLite.

Do not push sentinel rules into page code. Keep them in the submission service.

### Phase 3: Upgrade the learner result panel

Update the learner result UI to render:

- `Status`
- `Error type`
- `Message`
- `Line` / `Column` when available
- `Standard output`
- raw details in a collapsible panel

Recommended labels:

- `Checker says this answer still fails`
- `Compile error`
- `Runtime error`
- `Checker infrastructure error`

### Phase 4: Add authoring guidance

Add short help text in admin for hidden tests:

- JavaScript / TypeScript: `throw new Error("...")`
- Python: `assert ...`
- SQLite: emit sentinel failure rows
- C: print a checker sentinel to stderr, then exit non-zero
- Java: `throw new AssertionError("...")`

This keeps author behavior aligned with parser expectations.

## Suggested Parsing Rules

### JavaScript / TypeScript

Look for:

- `ReferenceError:`
- `TypeError:`
- `SyntaxError:`
- `__STACK_CHECK_FAILED__:`
- `__STACK_RUNTIME_FAILED__:`

Extract:

- first stack frame with `<anonymous>:line:column` or equivalent

### Python

Look for:

- `Traceback`
- final exception line
- `__STACK_CHECK_FAILED__:`
- `__STACK_RUNTIME_FAILED__:`

Extract:

- final `File "<stdin>", line N`

### SQLite

Look for:

- `__STACK_CHECK_FAILED__|`
- `syntax error`
- `no such table`
- `no such column`
- `near "...": syntax error`

Extract:

- the checker message from sentinel stdout rows
- syntax detail from stderr

### Java

Look for:

- `error:`
- `Exception in thread "main"`
- `AssertionError`
- `__STACK_CHECK_FAILED__:`
- `__STACK_RUNTIME_FAILED__:`

Extract:

- `Main.java:line`

### C

Look for:

- `error:`
- `warning:`
- `Segmentation fault`
- `Aborted`
- `__STACK_CHECK_FAILED__:`
- `__STACK_RUNTIME_FAILED__:`

Extract:

- first `file:line:column` compiler location
- runtime crash summary when the process exits abnormally

## UI Recommendation

For the learner result card, prefer this order:

1. `Status`
2. `Error type`
3. `Message`
4. `Standard output`
5. `Raw error details`

That keeps the first line understandable even when the raw runtime output is
noisy.

Example improved result for the current JavaScript case:

- Status: `Checker failed`
- Message: `Print the expected text`
- Standard output: `hello there!`

Not:

- Status: `Runtime Error (NZEC)`

## Acceptance Criteria

This feature is ready when:

1. checker failures are no longer mislabeled as learner runtime failures
2. compile errors show line-aware diagnostics where the runner provides them
3. SQLite checker failures use a stable sentinel contract instead of opaque SQL
   errors
4. the learner result panel can render one normalized error shape across
   JavaScript, TypeScript, Python, SQLite, C, and future Java
5. page components do not contain language-specific error parsing rules

## Recommended Build Order

1. add `LearnerFailure` model
2. extract parsing into `lib/submissions/error-feedback.ts`
3. add JavaScript / TypeScript sentinels
4. add Python sentinels
5. redesign SQLite hidden-test contract around sentinel result rows
6. update learner result UI
7. add Java support only after the wrapper contract is clean

That sequence keeps the design incremental while still investing in the deeper
module early.
