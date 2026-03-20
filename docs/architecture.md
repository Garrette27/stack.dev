# Core Architecture

## Short answer

Mostly yes, the current scaffold follows the intent of [AGENTS.md](/c:/Users/garre/boot.dev/docs/AGENTS.md), but not perfectly.

What it already does well:

- keeps the product centered on one obvious learning loop
- hides auth and database setup behind Supabase helpers
- keeps code checking behind a single submission API
- keeps authoring in a separate admin surface

What still needed to be made explicit:

- the app should be described in terms of the core loop, not in terms of random features
- the checker, admin, and billing should each have their own implementation boundary
- state decisions should be documented so complexity does not creep in later

This document fixes that.

## Core product loop

The product is not "a mini Boot.dev clone."

The product is:

1. read a short lesson
2. solve one coding exercise
3. get checked automatically
4. save progress
5. continue later

Everything else is a supporting subsystem:

- coding checker
- admin panel
- billing

If a new feature does not clearly strengthen one of those, it should wait.

## AGENTS-driven module boundaries

### Learner module

Interface:

- show course
- show lesson
- render prompt
- run checker
- show result
- save progress
- resume later

Hidden inside:

- where content comes from
- how submissions are persisted
- how completion is calculated

### Checker module

Interface:

- submit source code for a challenge
- receive pass or fail plus output

Hidden inside:

- Judge0 language ids
- hidden tests
- pass marker logic
- runner HTTP details

### Admin module

Interface:

- create lesson
- create challenge
- link lesson to challenge
- publish content

Hidden inside:

- table structure
- upsert details
- slug normalization

### Billing module

Interface:

- determine whether a user has access
- start checkout
- sync subscription state from webhooks

Hidden inside:

- payment provider details
- subscription tables
- webhook deduplication

## Should you use Redux?

No, not for this app base.

Reasons:

- most important state is server state, not client state
- auth lives in Supabase
- progress lives in Postgres
- lessons and challenges come from the server
- the editor state only needs local component state

Use this order instead:

1. URL state for navigation and filters
2. server components for content and progress reads
3. local React state for editor text, run status, and form inputs
4. only introduce a client store later if multiple distant components need the same live editor session state

If you ever need a store later, prefer a small store like Zustand over Redux for this product shape.

## Design rules for this repository

- One lesson should teach one idea.
- One challenge should verify one idea.
- Progress must remain obvious and durable.
- Completion should never regress after a pass.
- Hidden tests must never leave the server.
- Billing must gate access without contaminating learner code.

## The app shape you should keep

- `app/learn/*`
  - learner-facing routes only
- `app/admin/*`
  - authoring only
- `app/api/submissions`
  - single checker entrypoint
- `app/api/progress/resume`
  - single resume-state entrypoint
- `app/pricing`
  - billing surface only
- `supabase/schema.sql`
  - source of truth for data model

## Recommended next sequence

1. finish Supabase setup
2. finish Google OAuth
3. connect Judge0
4. sign in and set yourself as admin
5. create and pass a lesson end to end
6. only after that, wire billing
