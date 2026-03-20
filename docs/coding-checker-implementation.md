# Coding Checker Implementation

## Goal

The checker should feel simple to the learner:

- press run
- wait briefly
- see pass or fail

The complexity belongs inside the checker module, not the page.

## Current implementation in this repo

- learner submits code from [components/code/challenge-workbench.tsx](/c:/Users/garre/boot.dev/components/code/challenge-workbench.tsx)
- request goes to [app/api/submissions/route.ts](/c:/Users/garre/boot.dev/app/api/submissions/route.ts)
- the API loads the hidden tests on the server
- the API sends the combined source to Judge0
- the API stores submission history and progress in Supabase

## Current challenge model

Each challenge stores:

- `language`
- `judge0_language_id`
- `prompt_mdx`
- `starter_code`
- `solution_code`
- `hidden_test_code`

That is intentionally enough for v1.

## Why this is the right v1 shape

- it is deep enough to hide Judge0 details
- it avoids leaking hidden tests to the client
- it avoids introducing queues too early
- it keeps authoring understandable

## Security rule

Never trust the frontend with hidden tests or official solutions.

The only public interface should be:

- challenge prompt
- starter code
- result output

## Sequence to make it work

1. Create a Judge0 endpoint or use a Judge0-compatible hosted service.
2. Add `JUDGE0_API_URL` to `.env.local`.
3. Add `JUDGE0_API_KEY` if your provider requires it.
4. Keep only one language enabled first: `python`.
5. In the admin panel, create a lesson and challenge using plain assertion-style hidden tests.
6. Open the learner route and submit a passing solution.
7. Confirm that:
   - submission row is written
   - lesson progress becomes `completed`
   - resume state updates

## Good v1 checker rules

- keep time and memory limits low
- keep hidden tests short
- avoid multi-file projects at first
- do not add three languages before one language feels solid

## After v1

Only after real usage should you add:

- queued execution
- retry logic
- language-specific templates
- richer test reporting
