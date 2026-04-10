# Catalog Persistence Implementation

## Goal

Keep authored course content durable as the product grows into a larger
Boot.dev-style catalog.

The important rule is:

- authored catalog content should be hidden or restored
- authored catalog content should not be hard-deleted from the app workflow

## Recommended System Shape

Use a stable catalog core plus feature sidecars.

Stable catalog core:

- `courses`
- `lessons`
- `challenges`
- `lesson_challenges`
- `challenge_versions`

Feature sidecars:

- `lesson_progress`
- `resume_state`
- `challenge_review_state`
- analytics tables
- future ratings, enrollments, bookmarks, notes, etc.

This keeps learner features independent from authored content. Adding or
removing a feature should not require deleting or rewriting the catalog.

## Chosen Design

### 1. Reversible visibility, not destructive removal

Catalog content stays in storage and admin.

- courses use `published`
- lessons use `published`
- challenges use `published` plus version status

Learner readers only load visible rows. Admin readers load the full authored
snapshot.

### 2. Append-only assignment history

Assignments already use `challenge_versions`.

That means:

- published learner content can stay stable
- new edits can live in draft
- future product changes do not need to overwrite historical assignment content

### 3. Feature independence

Progress, review, analytics, and future catalog features should hang off the
stable content IDs instead of owning the content itself.

That means:

- deleting a feature table should not delete authored courses
- adding a new feature should not force a content migration unless the feature
  truly changes the catalog model

## Rules For Future Changes

When adding new catalog features:

1. Prefer new sidecar tables over modifying authored content tables.
2. Prefer `hide` / `restore` over `delete`.
3. Preserve existing `id` and `slug` values once content is created.
4. Keep public loaders filtered by learner visibility.
5. Keep admin loaders able to read hidden content.
6. If a feature needs history, add version rows or event rows instead of
   rewriting older authored records.

## Options Considered

### Option 1: Hard delete with backups

Not chosen.

Why:

- too easy to lose authored work from normal admin flows
- backups help recovery, but they do not make the application model safe

### Option 2: Soft delete flags only

Good baseline, but incomplete by itself.

Why:

- safe for visibility
- still weak if assignment edits overwrite history

### Option 3: Stable rows + reversible visibility + assignment versions

Chosen.

Why:

- simple learner-facing interface
- durable authored catalog
- supports scaling into many courses and projects
- fits `AGENTS.md` by keeping the deep persistence model separate from page UI

## Current Implementation Boundaries

Implemented now:

- admin catalog content uses hide/restore instead of delete
- assignment deletion is disabled
- course and chapter deletion is disabled
- draft saves preserve hidden content instead of silently republishing it

Still good follow-ups:

- add explicit archived metadata columns later if you want audit fields such as
  `archived_at` and `archived_by`
- add export/backup flows for authored content snapshots
- add automated integrity checks for orphaned lesson/challenge relations
