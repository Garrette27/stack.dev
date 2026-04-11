# Catalog Persistence Implementation

## Goal

Keep authored course content durable as the product grows into a larger
Boot.dev-style catalog.

The core rule is:

- authored catalog content should be hidden or restored
- authored catalog content should not be hard-deleted from the normal app workflow

## Durable System Shape

Use a stable catalog core plus append-only history plus feature sidecars.

Stable catalog core:

- `courses`
- `lessons`
- `challenges`
- `lesson_challenges`

Append-only authored history:

- `course_versions`
- `lesson_versions`
- `challenge_versions`
- `content_events`

Feature sidecars:

- `lesson_progress`
- `resume_state`
- `challenge_review_state`
- analytics tables
- future ratings, enrollments, bookmarks, notes, and learner-side features

This keeps learner/product features independent from authored content. Adding
or removing a feature should not require deleting or rewriting the catalog.

## Chosen Design

### 1. Stable rows with reversible visibility

Catalog content keeps durable IDs and slugs.

- courses use stable rows plus version pointers
- lessons use stable rows plus version pointers
- challenges use stable rows plus version pointers
- learner visibility is still driven by reversible published state

Learner readers only load published content. Admin readers load the current
draft when it exists, otherwise the published version.

### 2. Append-only versions as restore targets

Authoring no longer depends on mutable content rows as the only source of truth.

- each save creates a new draft or published version row
- stable rows point to the current published and current draft versions
- restore means "create a new draft from this historical version"
- older versions remain valid restore targets

### 3. Audit events for change history

`content_events` records operational history such as:

- hide
- restore
- publish
- save draft
- restore version
- duplicate
- bulk import
- reorder
- batch publish/hide

This gives the admin UI a safe way to answer:

- what changed
- who changed it
- when it changed
- which version IDs were involved

### 4. Feature independence

Progress, review, analytics, and future product features must hang off stable
catalog IDs instead of owning the content itself.

That means:

- deleting a feature table should not delete authored courses
- adding a feature should usually mean adding a sidecar table, not changing the
  catalog persistence model

## AGENTS.md Alignment

This design follows `AGENTS.md` by keeping the complexity in deep modules:

- `catalog-versioning` owns version creation, pointer updates, and audit events
- `catalog-workflows` owns restore, duplicate, clone, reorder, subtree
  visibility, and manifest import
- `content-lifecycle` stays a compatibility wrapper over the workflow layer
- loaders resolve the correct authored version inside deep modules instead of
  exposing version-selection logic to pages
- `/admin` stays mostly compositional and does not write catalog tables directly

## Implemented Now

Implemented in the current catalog system:

- `course_versions`
- `lesson_versions`
- `challenge_versions`
- `content_events`
- stable `current_published_version_id` / `current_draft_version_id` pointers
  for courses and lessons
- admin loaders reading draft-or-published versions
- learner loaders reading published versions only
- hide/restore instead of delete
- restore-from-version as a new draft
- duplicate assignment
- duplicate chapter with assignments
- clone course
- lesson and assignment reorder actions
- batch publish/hide actions for course and chapter trees
- JSON/MDX bulk import for `code`, `multiple_choice`, and `local_lab`
- admin UI panels for:
  - authoring
  - catalog tree actions
  - history
  - import

## Rules For Future Changes

When adding new catalog features:

1. Prefer sidecar tables over modifying authored catalog tables.
2. Prefer `hide` / `restore` over `delete`.
3. Preserve stable `id` and `slug` values once content is created.
4. Keep public loaders filtered by learner visibility and published pointers.
5. Keep admin loaders able to read hidden content and draft pointers.
6. If a feature needs history, add version rows or event rows instead of
   rewriting older authored records.
7. Do not add UI-level shortcuts that write catalog tables directly.

## Admin UI Model

The admin surface is intentionally not a GitHub clone.

It is split into three panels:

1. Authoring form
2. Catalog tree actions
3. History and import tools

### Authoring form

- create and edit course/chapter/assignment content
- save draft or publish
- continue using URL-based selection

### Catalog tree

- hide/restore
- publish/hide subtree
- duplicate assignment
- duplicate chapter with assignments
- clone course
- move up/down
- edit-in-authoring deep links

### History and import

History panel shows:

- visible/hidden state
- current published version
- current draft version
- recent versions
- restore as draft
- recent audit events with actor and summary

Import panel supports:

- JSON manifests
- MDX content stored as strings inside the JSON
- import as drafts
- import and publish

## Rollout Requirements

The durable behavior depends on:

- applying `supabase/migrations/20260411_add_catalog_versions_and_content_events.sql`

Before that migration lands, the code should degrade gracefully, but full
version history, restore, and audit behavior will be partial.

## What This Prevents

This design prevents common catalog-loss failure modes:

- deleting a course because a UI feature changed
- losing old authored content after a publish
- having no restore target after a mistaken edit
- coupling learner analytics/progress to authored content ownership
- rebuilding catalog history from page-level behavior

## Best Long-Term System For Scale

If the goal is to create a Boot.dev-scale catalog quickly, the right system is:

- stable catalog rows
- reversible visibility
- append-only version rows
- audit events
- import, clone, duplicate, and reorder tooling

That gives you:

- safety
- restore capability
- future flexibility
- faster catalog production
