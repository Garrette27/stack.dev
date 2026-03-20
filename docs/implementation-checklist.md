# Implementation Checklist

## Core services

- `Vercel`
  - hosts the Next.js frontend
  - stores environment variables
  - handles the public web entrypoint
- `Supabase`
  - Auth for Google sign-in
  - Postgres for courses, lessons, challenges, progress, submissions, and resume state
  - Table Editor for quick debugging and manual admin fixes
- `Google Cloud OAuth`
  - used by Supabase Auth for Google login
  - Firebase is not required
- `Judge0 or Judge0-compatible runner`
  - executes hidden tests in an isolated environment
  - should stay separate from Vercel

## Environment variables

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JUDGE0_API_URL=
JUDGE0_API_KEY=
```

## Database tables

- `profiles`
  - stores role and display metadata
- `courses`
  - learner-visible course shell
- `lessons`
  - MDX lesson body plus challenge link
- `challenges`
  - prompt, starter code, solution, hidden tests, runner language
- `submissions`
  - every code attempt
- `lesson_progress`
  - completion state per lesson
- `resume_state`
  - where the learner should continue next

## Product rules worth keeping

- One lesson should teach one idea.
- One challenge should verify one idea.
- Completion should stay completed after a successful pass.
- Resume state should update even if the learner has not passed yet.
- Hidden tests should never be exposed to the client.

## Good first production limits

- Start with one language: `python`
- Set Judge0 CPU and memory limits conservatively
- Avoid realtime as a core dependency
- Keep the admin private for a while
- Keep payments and teams out of v1

## First post-MVP upgrades

- Better authoring templates per challenge type
- Draft and publish workflow
- Submission queue if wait-time becomes noticeable
- More granular analytics
- Paid access and billing

## Read next

- [Core architecture](/c:/Users/garre/boot.dev/docs/architecture.md)
- [Coding checker implementation](/c:/Users/garre/boot.dev/docs/coding-checker-implementation.md)
- [Admin panel implementation](/c:/Users/garre/boot.dev/docs/admin-panel-implementation.md)
- [Payment system implementation](/c:/Users/garre/boot.dev/docs/payment-system-implementation.md)
