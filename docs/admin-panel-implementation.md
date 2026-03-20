# Admin Panel Implementation

## Goal

The admin panel exists for one reason:

You must be able to add a new lesson and coding exercise quickly enough that authoring does not become the bottleneck.

## Current implementation in this repo

- screen: [app/admin/page.tsx](/c:/Users/garre/boot.dev/app/admin/page.tsx)
- save action: [app/admin/actions.ts](/c:/Users/garre/boot.dev/app/admin/actions.ts)

The panel currently lets you create:

- course shell
- lesson title and summary
- lesson body in MDX
- challenge title and prompt
- starter code
- solution code
- hidden tests

## Why the admin is intentionally simple

This matches your AGENTS rules:

- avoid shallow abstractions
- avoid overexposing configuration
- keep complexity inside the module

A polished CMS too early would create more moving parts before you understand your actual authoring workflow.

## Sequence to start using it immediately

1. Run the SQL in [supabase/schema.sql](/c:/Users/garre/boot.dev/supabase/schema.sql).
2. Sign in once with Google.
3. In Supabase Table Editor, set your `profiles.role` to `admin`.
4. Open `/admin`.
5. Create one lesson and one challenge.
6. Open the learner route and verify the lesson renders.
7. Run a submission and confirm progress saves.

## What to improve next

Once the first 10 to 20 lessons exist, add:

- draft versus published state
- duplicate challenge button
- challenge templates by language
- preview before publish
- lesson ordering controls

## What not to build yet

- multi-author editorial workflow
- WYSIWYG editors
- media management
- granular role systems

Those are tactical additions until your content model is stable.
