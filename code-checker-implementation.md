# Code Checker Implementation

## Goal

Provide a reliable Judge0-backed checking pipeline for learner assignments while keeping runner-specific decisions hidden behind deeper modules.

## Current State

The app already routes learner submissions through:

1. [`/api/submissions`](C:/Users/garre/boot.dev/app/api/submissions/route.ts)
2. [`lib/submissions`](C:/Users/garre/boot.dev/lib/submissions/index.ts)

That service is responsible for:

- loading the authored challenge
- building runner source
- sending it to Judge0
- polling for the result
- extracting readable errors
- persisting submissions
- updating lesson progress and resume state

## Languages Prepared In Code

Language defaults now live in one place:

- [`lib/judge0/languages.ts`](C:/Users/garre/boot.dev/lib/judge0/languages.ts)

Prepared language set:

- JavaScript: `102`
- TypeScript: `101`
- Python: `71`
- Go: `107`
- SQL (SQLite): `82`

These ids were verified against the public [`ce.judge0.com/languages`](https://ce.judge0.com/languages) endpoint that matches this project’s current Judge0 host.

## Current Support Level

### Fully usable now

- JavaScript
- TypeScript
- Python

These currently have:

- authoring support
- editor file naming
- starter / solution / hidden test templates
- runner source generation
- readable error extraction

### Prepared, but authoring discipline matters

- Go
- SQL (SQLite)

These now have:

- language ids
- editor file naming
- authoring templates
- runner source generation

Important:

- Go hidden tests are injected into an `init()` function, so hidden test code should be written as Go statements, not as a second full file.
- SQLite checks are statement-based. Hidden tests should be authored as SQL statements that raise an error when expectations are not met.

## Runner Behavior By Language

### JavaScript / TypeScript

- learner source runs first
- `console.log` output is captured into `stackOutput`
- hidden tests can assert both function behavior and output
- a pass marker is printed only after hidden tests succeed

### Python

- learner source runs with stdout mirrored into `stackOutput`
- hidden tests can assert return values or printed output
- a pass marker is printed only after hidden tests succeed

### Go

- learner source is treated as the main Go file
- hidden tests are inserted into `func init()`
- hidden tests should use `panic("message")` for failures
- the pass marker is printed from the generated `init()` wrapper

### SQL (SQLite)

- learner SQL runs first
- hidden tests are appended as additional SQL statements
- hidden tests should force an error when the result is wrong
- the pass marker is emitted with a final `select`

## Recommended Hidden Test Style

### JavaScript / TypeScript

```ts
if (greet("Ada") !== "Hello, Ada!") {
  throw new Error("Ada greeting is incorrect")
}
```

### Python

```python
assert greet("Ada") == "Hello, Ada!"
```

### Go

```go
if greet("Ada") != "Hello, Ada!" {
	panic("Ada greeting is incorrect")
}
```

### SQLite

```sql
select case
  when exists (
    select 1
    from messages
    where content = 'Starting Textio server...'
  ) then 1
  else missing_expected_output('Expected row was not produced')
end;
```

## Error Model

Learners should continue to see:

- pass / fail
- readable failure message
- standard output
- compile output when relevant
- runtime errors when relevant

Readable error extraction stays centralized in:

- [`lib/submissions/index.ts`](C:/Users/garre/boot.dev/lib/submissions/index.ts)

That keeps page components free from runner parsing details.

## Authoring Surface

The admin form already reads from the shared Judge0 language config:

- [`components/admin/authoring-form.tsx`](C:/Users/garre/boot.dev/components/admin/authoring-form.tsx)

That means:

- language picker
- starter code
- solution code
- hidden test templates
- fenced reading-code examples

all stay aligned with the same deep module.

## Learner Workbench

The learner workbench uses the same language config for:

- source file names
- hidden test file names
- solution file names
- Monaco language modes

Implementation:

- [`components/code/challenge-workbench.tsx`](C:/Users/garre/boot.dev/components/code/challenge-workbench.tsx)

## Remaining Follow-Up Before Heavy Content Authoring

1. Add one real TypeScript assignment and verify:
   - pass
   - wrong answer
   - compile error
2. Add one real Go assignment and verify the `init()` hidden-test pattern.
3. Add one real SQLite assignment and verify the authored SQL error pattern.
4. If SQLite authoring becomes common, add helper templates for common table-setup/check flows.

## Acceptance Criteria

The checker preparation is in a good state when:

- admin can author JavaScript, TypeScript, Python, Go, and SQLite assignments
- learner sees correct file names and Monaco modes
- Judge0 runs use the correct language id
- readable errors still surface through one shared submission service
- no page component needs to know runner assembly details

## Design Notes

This follows `AGENTS.md` by:

- keeping language/runtime knowledge in [`lib/judge0/languages.ts`](C:/Users/garre/boot.dev/lib/judge0/languages.ts)
- keeping runner assembly and Judge0 polling in [`lib/submissions/index.ts`](C:/Users/garre/boot.dev/lib/submissions/index.ts)
- avoiding page-level language conditionals
- preferring a few deeper modules over many shallow UI-only switches
