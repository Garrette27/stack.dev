# Setup Guide

## 1. Install the app locally

1. Install Node.js 20 or newer.
2. In the project root, run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Run `npm run dev`.

## 2. Create the Supabase project

1. Create a new Supabase project in the `ap-southeast-1` region (Singapore).
2. Open the SQL editor and run [`supabase/schema.sql`](/c:/Users/garre/boot.dev/supabase/schema.sql).
3. Copy these values into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 3. Configure Google sign-in

You do **not** need Firebase for this setup.

Use Google Cloud OAuth directly:

1. In Google Cloud Console, create an OAuth 2.0 Client ID.
2. Add the Supabase callback URL from `Authentication -> Providers -> Google`.
3. In Supabase, open `Authentication -> Sign In / Providers -> Google`.
4. Paste the Google client ID and client secret.
5. Add your site URL:
   - local: `http://localhost:3000`
   - production: your Vercel domain
6. Add the redirect path used by this app:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`

## 4. Make yourself admin

1. Sign in once with Google.
2. In Supabase Table Editor, open `profiles`.
3. Change your `role` from `student` to `admin`.

That unlocks the `/admin` authoring screen.

## 5. Configure the Judge0 runner

This scaffold expects an external Judge0-compatible endpoint.

Add to `.env.local`:

```env
JUDGE0_API_URL=https://your-judge0-host
JUDGE0_API_KEY=optional-if-your-provider-requires-it
```

The submission API sends:

- `language_id`
- combined `source_code`
- CPU and memory limits

For this scaffold, the hidden test code is appended server-side and a pass marker is added automatically.

### Recommended progression

1. Start with Python only.
2. Use one fixed `judge0_language_id` at first.
3. Keep tests as plain assertions in `hidden_test_code`.
4. Move to a richer worker architecture only after you have real traffic.

## 6. Deploy

1. Push the repo to GitHub.
2. Import it into Vercel.
3. Add the same environment variables in Vercel.
4. Set your production URL in Supabase Auth redirect settings.

## 7. First content workflow

1. Sign in with Google.
2. Set your profile to `admin`.
3. Open `/admin`.
4. Create one lesson and one challenge.
5. Open the learner route and confirm:
   - lesson renders
   - challenge loads
   - save for later updates resume state
   - passing the challenge marks the lesson complete
