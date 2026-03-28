# Subscription Implementation

## Goal

Add a paid subscription layer without disturbing the learner loop:

- public pricing page persuades career shifters to subscribe
- checkout starts from one primary plan
- webhook updates subscription state in Supabase
- learner access checks stay simple
- billing logic stays behind deep modules instead of leaking across pages

This plan follows the current architecture:

- Next.js frontend on Vercel
- Supabase Auth + Postgres
- pricing/access helpers in `lib/billing`
- future payment provider integration hidden behind server routes or server-only modules

## Current State

Already in place:

- pricing page reads from `lib/billing/plans.ts`
- subscription access lookup lives in `lib/billing/access.ts`
- schema already includes `subscriptions` and `payment_events`
- app can distinguish anonymous vs inactive vs active subscribers

Not implemented yet:

- checkout session creation
- webhook ingestion
- plan records in the database
- paid content gating
- billing portal / manage subscription flow

## Design Rules

Keep these boundaries stable:

1. `app/pricing` should only render plans and links.
2. `lib/billing` should own billing logic and access checks.
3. Provider-specific details should live behind one server-only adapter.
4. Webhook payload handling should write normalized rows into `subscriptions` and `payment_events`.
5. Pages should ask one question only: `canAccessPaidContent`.

That keeps the module interfaces simple and follows `AGENTS.md`.

## Target Flow

### Public flow

1. User opens `/pricing`
2. User clicks the primary plan CTA
3. App creates a checkout session
4. Provider redirects to hosted checkout
5. Provider returns to success/cancel page
6. Webhook confirms the real subscription state
7. App updates access in `subscriptions`

### Access flow

1. User signs in
2. App calls `getCurrentSubscriptionAccess()`
3. Protected routes check `canAccessPaidContent`
4. If inactive, redirect to `/pricing`

## Data Model

### `plans`

Recommended columns:

- `id uuid primary key`
- `slug text unique not null`
- `name text not null`
- `provider text not null`
- `provider_price_id text not null`
- `interval text not null`
- `price_amount int not null`
- `currency text not null`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `subscriptions`

Keep using the existing table as the source of truth for app access:

- `user_id`
- `plan_id`
- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `status`
- `current_period_end`
- `cancel_at_period_end`

### `payment_events`

Use this for webhook history and replay safety:

- `provider`
- `provider_event_id`
- `event_type`
- `payload`
- `processed_at`

## Recommended Repo Structure

Add the billing code in these layers:

### `lib/billing`

- `plans.ts`
  - public plan catalog
  - plan lookup by slug
- `access.ts`
  - current subscription access
  - route-safe paid-content check
- `provider.ts`
  - small interface for billing providers
- `checkout.ts`
  - create checkout session through provider adapter
- `webhooks.ts`
  - normalize provider webhook payloads

### `app`

- `app/pricing/page.tsx`
  - render plan marketing
- `app/api/billing/checkout/route.ts`
  - create checkout session
- `app/api/billing/webhook/route.ts`
  - receive and process webhooks
- `app/billing/success/page.tsx`
  - success state
- `app/billing/cancel/page.tsx`
  - cancel state

## Provider Adapter Shape

Keep the provider interface small:

```ts
export type CheckoutRequest = {
  planSlug: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}

export type CheckoutResult = {
  checkoutUrl: string
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutRequest): Promise<CheckoutResult>
  verifyWebhook(request: Request): Promise<NormalizedBillingEvent | null>
}
```

This is deeper than putting provider logic directly in routes.

## Environment Variables

Prepare these env vars:

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
BILLING_PROVIDER=stripe
BILLING_WEBHOOK_SECRET=...
```

If the chosen provider needs extra credentials, keep them server-only:

```env
BILLING_SECRET_KEY=...
```

Do not expose billing secrets in `NEXT_PUBLIC_*`.

## Implementation Steps

### Phase 1: Plan records

1. Add a migration for `plans` if it does not already exist in the live database.
2. Seed one launch plan:
   - slug: `career-shifter-monthly`
   - name: `Career Shifter Access`
   - interval: `month`
3. Update `lib/billing/plans.ts` to optionally read from DB later, but keep the public fallback.

### Phase 2: Checkout route

Create:

- `app/api/billing/checkout/route.ts`

Responsibilities:

- require authenticated user
- accept `planSlug`
- resolve the plan
- call `createCheckoutSession`
- return `{ checkoutUrl }`

UI behavior:

- CTA button calls this route
- browser redirects to returned URL

### Phase 3: Webhook route

Create:

- `app/api/billing/webhook/route.ts`

Responsibilities:

- verify provider signature
- normalize event
- insert raw payload into `payment_events`
- upsert `subscriptions`
- ignore duplicate events safely

Webhook writes should be idempotent.

### Phase 4: Paid access guard

Add one helper in `lib/billing/access.ts`:

```ts
export async function requirePaidAccess() {}
```

Use it for future paid routes.

Behavior:

- anonymous -> redirect to `/login`
- signed-in but inactive -> redirect to `/pricing`
- active -> continue

### Phase 5: Success and account state

Create:

- `app/billing/success/page.tsx`
- `app/billing/cancel/page.tsx`

Success page should:

- tell the user access is being confirmed
- link back to dashboard or learn page

Do not trust the success redirect alone. Webhook remains the source of truth.

### Phase 6: Manage subscription

Later, add:

- billing portal link
- cancel/reactivate flows
- account settings section

This should come after checkout + webhook are stable.

## UI Tasks

### Pricing page

Keep the current persuasive copy structure, but evolve the CTA from “sign in” to:

- signed out: `Sign in to subscribe`
- signed in inactive: `Start subscription`
- signed in active: `Open your learning path`

### Dashboard

Later add one subscription card:

- plan name
- status
- renewal date
- manage billing button

Keep it small and separate from learner progress.

## Suggested Supabase Migration

If `plans` is not yet in the live database, add a migration like:

```sql
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  provider text not null,
  provider_price_id text not null,
  interval text not null,
  price_amount int not null,
  currency text not null default 'PHP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Analytics Note

The app is now prepared to track:

- path
- referrer
- approximate country / region / city from hosting headers
- device type
- browser
- operating system

It does **not** capture exact GPS location.

Before using it publicly:

1. run `supabase/migrations/20260328_add_page_visits.sql`
2. add a privacy policy disclosure
3. decide whether you want an opt-out / consent banner

## Acceptance Criteria

Subscription implementation is ready when:

1. one plan exists in `plans`
2. clicking the pricing CTA creates a checkout session
3. webhook writes `payment_events`
4. webhook upserts `subscriptions`
5. `getCurrentSubscriptionAccess()` returns `active` for paid users
6. protected routes can gate paid content with one helper

## Recommended Build Order

Build in this order:

1. add `plans` migration
2. seed one monthly plan
3. create checkout route
4. create webhook route
5. update pricing CTA
6. add success/cancel pages
7. gate one paid route
8. add dashboard billing status

This keeps complexity incremental and prevents billing logic from spreading through the app.
