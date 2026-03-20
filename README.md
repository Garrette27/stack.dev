# stack.dev.ph

Small Boot.dev-style scaffold for a text-first coding platform:

- learner UI
- simple internal admin
- Google sign-in through Supabase
- progress tracking
- isolated code checking through Judge0

## What is included

- `Next.js + TypeScript`
- `Tailwind` styling with shadcn-style primitives
- `Supabase` auth and Postgres content/progress model
- `MDX` lesson and prompt rendering
- sample learner flow and admin authoring form
- sample SQL schema and seed data

## Key routes

- `/` landing page
- `/login` Google sign-in
- `/dashboard` progress and resume view
- `/learn/[courseSlug]` course view
- `/learn/[courseSlug]/[lessonSlug]` lesson + coding challenge
- `/admin` internal authoring screen

## Important implementation choices

- App code stays in `.ts/.tsx`.
- Lesson text and challenge prompts are stored as MDX strings in Supabase so you can author through an admin UI.
- Hidden tests never go to the client.
- Firebase is not required for Google login in this stack.

## Setup

Use the guide in [docs/setup.md](/c:/Users/garre/boot.dev/docs/setup.md).

## Architecture docs

- [Core architecture](/c:/Users/garre/boot.dev/docs/architecture.md)
- [Coding checker implementation](/c:/Users/garre/boot.dev/docs/coding-checker-implementation.md)
- [Admin panel implementation](/c:/Users/garre/boot.dev/docs/admin-panel-implementation.md)
- [Payment system implementation](/c:/Users/garre/boot.dev/docs/payment-system-implementation.md)
