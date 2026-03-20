# Payment System Implementation

## Goal

Billing should do one job well:

- decide who has paid access

It should not leak provider details into learner pages, progress logic, or the checker.

## Recommended shape for your market

For a Philippines-first product, use a provider that supports local payment methods when you go paid.

That means your billing design should expect:

- cards
- local wallets
- webhook-based status sync

The database model in [supabase/schema.sql](/c:/Users/garre/boot.dev/supabase/schema.sql) already includes:

- `plans`
- `subscriptions`
- `payment_events`

## What the billing module should own

- checkout creation
- webhook verification
- subscription sync
- entitlement decisions

The learner module should only ask:

- does this user have access to this plan or lesson set?

## Recommended v1 paid model

Start with one paid plan only.

Example:

- `Solo Builder`
  - free
  - personal use while you create content
- `Focused Pro`
  - paid
  - unlocks premium tracks or premium challenge sets later

## Implementation sequence

1. Keep the app free until the admin and checker work reliably.
2. Decide the payment provider only when you are ready to charge real users.
3. Create the provider customer and checkout session from a server route.
4. Save provider identifiers into `subscriptions`.
5. Receive webhook events and write them into `payment_events`.
6. Update `subscriptions.status` from webhook truth, not from frontend assumptions.
7. Add one access-check helper for paid content.
8. Add a pricing page and lock premium routes only after webhook sync is working.

## Why this design is correct

- it keeps payment complexity behind one boundary
- it avoids sprinkling provider-specific checks across pages
- it preserves your core learning loop even if billing changes later

## What not to do

- do not gate free lessons immediately
- do not make billing part of progress logic
- do not trust the frontend to declare subscription state
- do not mix entitlement logic with admin logic

## Recommended next step

Do not implement live billing before this is true:

- you can create lessons quickly
- the checker is reliable
- progress never gets lost

When those three are stable, then wire the provider webhooks and access control.
