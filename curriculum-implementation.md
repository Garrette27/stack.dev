# Curriculum Implementation

## Goal

Prepare the app for a Boot.dev-scale catalog without breaking the existing
course, chapter, and assignment model.

The target system should be able to represent:

- large learning paths
- standard courses
- guided projects
- portfolio projects
- training or drill content
- deeper-learning shelves
- future local CLI and Docker-based lab lessons

## Design Choice

Do not replace the current content model.

Keep:

- `course`
- `lesson`
- `challenge`

Add one deeper layer above it:

- `curriculum`

That layer is responsible for:

- grouping courses into shelves
- mapping courses into paths
- labeling experiences as course / guided project / portfolio project /
  training
- deciding catalog ordering

This follows `AGENTS.md` because the UI no longer has to reconstruct path logic
from raw course rows.

## Current Foundation

Already in the app:

- one published-content loader in `lib/content`
- learner catalog pages under `/learn`
- lesson progress and resume state
- assignment-level review state
- authoring UI for courses, chapters, and assignments

Added in this pass:

- `lib/curriculum/index.ts`

That module now merges raw published courses with a curriculum definition so the
catalog can grow into larger shelves and paths without changing the underlying
authoring flow.

## Recommended Product Model

### Layer 1: Curriculum

The learner sees:

- paths
- shelves
- course categories

Examples:

- `Back-end Developer Path (Python & Go)`
- `Courses`
- `Guided projects`
- `Portfolio projects`
- `Deeper learning`

### Layer 2: Course

Each course remains the main authored container:

- title
- summary
- difficulty
- chapters

Examples:

- `Learn Docker`
- `Learn SQL`
- `Build a Pokedex`

### Layer 3: Chapter / Lesson

Each chapter keeps:

- reading
- assignments
- practice sequencing

### Layer 4: Challenge

Each challenge keeps its own delivery model:

- code assignment
- multiple choice
- future local lab
- future Docker lab

## Recommended Future Challenge Types

Keep the current kinds:

- `code`
- `multiple_choice`

Add later:

- `local_lab`
- `docker_lab`
- `guided_cli`

### `local_lab`

Best first step toward Boot.dev-like lessons.

Use it for:

- terminal commands on the learner machine
- file edits on the learner machine
- local verification through your CLI

### `docker_lab`

Use when the learner needs:

- services
- multi-process setup
- environment isolation

### `guided_cli`

A lighter option than full labs.

Use it when the lesson needs:

- copyable terminal commands
- command output expectations
- no embedded Monaco editor

## Catalog Rules

The curriculum layer should answer these questions for pages:

1. which path cards should render?
2. which courses belong in `Courses`?
3. which courses belong in `Guided projects`?
4. which courses belong in `Portfolio projects`?
5. which courses belong in `Deeper learning`?
6. what order should each section use?

Pages should not answer those questions themselves.

## Authoring Recommendation

Keep authoring centered on individual courses for now.

Do not force authors to manage paths while they are writing lesson content.

Instead:

- authoring owns course / chapter / assignment content
- curriculum config or admin tools own path grouping and course categorization

That separation avoids mixing content-writing concerns with merchandising and
catalog structure.

## Recommended Next Steps

### Phase 1: Catalog metadata in code

Good for the current stage.

Store:

- course kind
- shelf
- path membership
- sort order

in one curriculum module.

Benefits:

- fast to ship
- easy to reason about
- low migration risk

### Phase 2: Move curriculum metadata into the database

Add tables like:

- `learning_paths`
- `learning_path_courses`
- `course_catalog_metadata`

Use this when non-developers need to manage catalog organization.

### Phase 3: Add learner progress summaries per course

For Boot.dev-style catalog cards, add:

- completed chapters / total chapters
- last opened chapter
- current path position

That should come from one progress-domain summary module, not from the page.

### Phase 4: Add lab delivery modes

Introduce:

- local CLI runner
- Docker-backed lessons
- richer learner result views

## Boot.dev-Style Course Options

If you want lessons like Boot.dev's local-environment courses, you have four
good options:

### Option 1: Guided CLI lessons

Lowest complexity.

- website shows instructions
- learner copies commands
- CLI checks result

Good for:

- Git
- Linux
- basic shell

### Option 2: Local lab lessons

Best long-term default.

- lesson includes manifest
- CLI runs local checks
- app records pass/fail and feedback

Good for:

- programming language tooling
- HTTP
- SQL
- file-system exercises

### Option 3: Docker labs

Best for environment-heavy topics.

- CLI starts a container or compose stack
- checks run inside the environment

Good for:

- Docker
- Kubernetes
- databases
- DevOps

### Option 4: Hosted cloud labs

Best UX, highest complexity and cost.

- remote containers or sandboxes
- browser-based setup

Good after the local lab model is proven.

## Recommended Product Order

Build in this order:

1. curriculum grouping
2. course-level progress summaries
3. `guided_cli` or `local_lab`
4. Docker-backed labs
5. optional path-specific dashboards

That keeps the design strategic and incremental.

## Acceptance Criteria

The app is prepared for a larger Boot.dev-style catalog when:

1. the learner catalog can group content by shelf and course kind
2. multiple paths can point at the same course without duplicating content
3. projects and standard courses can coexist cleanly
4. future lab-style challenges can be added without rewriting the course model
5. catalog logic lives in one deeper module instead of scattered page code
