# Spaced Repetition Implementation

## Goal

Add a practice mode that behaves like a shuffled playlist, but still remembers:

- which assignments the learner has never passed
- which assignments they missed recently
- which assignments are due for review
- which assignments are already stable enough to show less often

The target experience is closer to "shuffle this course intelligently" than a
full Anki clone.

## Recommended Product Shape

Add one learner action later:

- `Practice this course`

That action should build a queue for the selected course, then navigate the
learner through assignments in this order:

1. recently failed / learning items
2. unseen items
3. due review items
4. already-mastered items

Within each group, shuffle the order so the experience feels fresh.

## Why This Fits The Current App

The app already knows:

- which assignment the learner is on
- whether a submission passed
- which assignments are marked complete

The missing piece is durable assignment-level review state. That should live in
one deeper module instead of being reconstructed in page components.

## Database Preparation

Migration prepared here:

- [supabase/migrations/20260330_add_challenge_review_state.sql](C:/Users/garre/boot.dev/supabase/migrations/20260330_add_challenge_review_state.sql)

Table:

- `challenge_review_state`

It stores:

- latest result
- success streak
- total passes / fails
- last reviewed time
- next review time
- last submission id

## Scheduling Module

Prepared here:

- [lib/review/scheduler.ts](C:/Users/garre/boot.dev/lib/review/scheduler.ts)

It already provides:

- `scheduleNextChallengeReview`
- `getReviewBucket`
- `buildPracticeQueue`

This uses a simple staircase instead of a full SM-2 algorithm:

- fail -> review again in 10 minutes
- pass 1 -> 1 day
- pass 2 -> 3 days
- pass 3 -> 7 days
- pass 4 -> 14 days
- later passes -> 30 days

That is easier to reason about and good enough for the first version.

## Suggested Integration Path

### Step 1

When a learner submits an assignment, update `challenge_review_state` from
inside:

- [lib/submissions/index.ts](C:/Users/garre/boot.dev/lib/submissions/index.ts)

Do this in the same deep module that already persists submissions and lesson
progress. Do not push review scheduling logic into the route or the page.

### Step 2

Add a course-level practice entry point:

- `/learn/[courseSlug]/practice`

That page should:

- load all challenge ids for the course
- load the learner's `challenge_review_state`
- call `buildPracticeQueue`
- route into the first assignment

### Step 3

Add a learner control like:

- `Shuffle practice`
- `Review due items`

These should be queue modes, not separate storage models.

## Queue Modes

### Mode 1: Smart Shuffle

Best first version.

- keeps misses and unseen items near the front
- still shuffles within each group
- feels like playlist shuffle

### Mode 2: Due Reviews Only

Good after the queue exists.

- only show assignments due now
- closer to Anki review sessions

### Mode 3: Missed Again

Useful short drill mode.

- only assignments with latest result = failed

## UI Recommendation

Keep it simple at first:

- add one card on the course page
- show counts:
  - unseen
  - due
  - learning
- include one CTA:
  - `Start smart shuffle`

Later you can add:

- `Review due`
- `Practice missed again`

## Design Notes

This follows `AGENTS.md` by:

- keeping scheduling logic in one deep module
- avoiding page-level scoring / review heuristics
- separating persistence decisions from learner UI
- reusing existing submission/progress flows instead of creating a second
  parallel progress system
