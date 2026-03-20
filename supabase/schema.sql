create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  difficulty text not null default 'Beginner',
  accent text not null default '#c96f36',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  language text not null check (language in ('python', 'javascript')),
  judge0_language_id integer not null,
  prompt_mdx text not null,
  starter_code text not null,
  solution_code text not null,
  hidden_test_code text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  estimated_minutes integer not null default 10,
  body_mdx text not null,
  challenge_slug text references public.challenges (slug) on delete set null,
  order_index integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  source_code text not null,
  status text not null default 'queued',
  stdout text not null default '',
  stderr text not null default '',
  compile_output text not null default '',
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  last_submission_id uuid references public.submissions (id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.resume_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  course_slug text not null,
  lesson_slug text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0,
  currency text not null default 'PHP',
  provider text not null default 'xendit',
  provider_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  provider text not null default 'xendit',
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_courses_updated_at on public.courses;
create trigger touch_courses_updated_at
before update on public.courses
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_challenges_updated_at on public.challenges;
create trigger touch_challenges_updated_at
before update on public.challenges
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_lessons_updated_at on public.lessons;
create trigger touch_lessons_updated_at
before update on public.lessons
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_plans_updated_at on public.plans;
create trigger touch_plans_updated_at
before update on public.plans
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_subscriptions_updated_at on public.subscriptions;
create trigger touch_subscriptions_updated_at
before update on public.subscriptions
for each row execute procedure public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.resume_state enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read"
on public.courses for select
using (published or public.is_admin());

drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write"
on public.courses for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "lessons_public_read" on public.lessons;
create policy "lessons_public_read"
on public.lessons for select
using (published or public.is_admin());

drop policy if exists "lessons_admin_write" on public.lessons;
create policy "lessons_admin_write"
on public.lessons for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "challenges_public_read" on public.challenges;
create policy "challenges_public_read"
on public.challenges for select
using (published or public.is_admin());

drop policy if exists "challenges_admin_write" on public.challenges;
create policy "challenges_admin_write"
on public.challenges for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "submissions_select_self" on public.submissions;
create policy "submissions_select_self"
on public.submissions for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "submissions_insert_self" on public.submissions;
create policy "submissions_insert_self"
on public.submissions for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "lesson_progress_select_self" on public.lesson_progress;
create policy "lesson_progress_select_self"
on public.lesson_progress for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "lesson_progress_upsert_self" on public.lesson_progress;
create policy "lesson_progress_upsert_self"
on public.lesson_progress for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "resume_state_select_self" on public.resume_state;
create policy "resume_state_select_self"
on public.resume_state for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "resume_state_upsert_self" on public.resume_state;
create policy "resume_state_upsert_self"
on public.resume_state for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "plans_public_read" on public.plans;
create policy "plans_public_read"
on public.plans for select
using (active or public.is_admin());

drop policy if exists "plans_admin_write" on public.plans;
create policy "plans_admin_write"
on public.plans for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "subscriptions_select_self" on public.subscriptions;
create policy "subscriptions_select_self"
on public.subscriptions for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write"
on public.subscriptions for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payment_events_admin_only" on public.payment_events;
create policy "payment_events_admin_only"
on public.payment_events for all
using (public.is_admin())
with check (public.is_admin());

insert into public.courses (slug, title, summary, difficulty, accent, published)
values (
  'backend-foundations',
  'Backend Foundations',
  'A text-first path for backend thinking: data flow, functions, and practical code checks.',
  'Beginner',
  '#c96f36',
  true
)
on conflict (slug) do nothing;

insert into public.challenges (
  slug,
  title,
  language,
  judge0_language_id,
  prompt_mdx,
  starter_code,
  solution_code,
  hidden_test_code,
  published
)
values (
  'python-greet-user',
  'Write a greeting function',
  'python',
  71,
  'Create a function named `greet` that returns `Hello, {name}!`.',
  E'def greet(name):\n    raise NotImplementedError("write your solution here")\n',
  E'def greet(name):\n    return f"Hello, {name}!"\n',
  E'assert greet("Ada") == "Hello, Ada!"\nassert greet("Rico") == "Hello, Rico!"\n',
  true
)
on conflict (slug) do nothing;

insert into public.lessons (
  course_id,
  slug,
  title,
  summary,
  estimated_minutes,
  body_mdx,
  challenge_slug,
  order_index,
  published
)
select
  courses.id,
  'functions-and-feedback',
  'Functions and feedback loops',
  'Learn why tiny functions, fast checks, and visible progress are enough to build momentum every day.',
  12,
  E'# Build small loops that compound\n\nBoot.dev works because it keeps the loop tight: read a little, code a little, check a little, move on.\n\n## What matters in your product\n\n1. The lesson should be short enough to finish in one sitting.\n2. The challenge should verify one idea clearly.\n3. The progress system should make it obvious where to continue next.',
  'python-greet-user',
  1,
  true
from public.courses
where courses.slug = 'backend-foundations'
on conflict (course_id, slug) do nothing;

insert into public.plans (slug, name, description, price_cents, currency, provider, active)
values
  (
    'solo-builder',
    'Solo Builder',
    'Private use while you build the curriculum and the admin workflow.',
    0,
    'PHP',
    'xendit',
    true
  ),
  (
    'focused-pro',
    'Focused Pro',
    'Future paid tier for unlocked content and subscription-based access.',
    49900,
    'PHP',
    'xendit',
    true
  )
on conflict (slug) do nothing;
