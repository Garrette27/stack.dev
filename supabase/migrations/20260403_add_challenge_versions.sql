create table if not exists public.challenge_versions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  source_version_id uuid references public.challenge_versions(id) on delete set null,
  title text not null,
  kind text not null default 'code',
  language text,
  judge0_language_id integer,
  reading_mdx text,
  prompt_mdx text not null default '',
  starter_code text not null default '',
  solution_code text not null default '',
  hidden_test_code text not null default '',
  choice_options jsonb not null default '[]'::jsonb,
  choice_correct_key text,
  choice_explanation_mdx text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (challenge_id, version_number)
);

create index if not exists idx_challenge_versions_challenge_id
  on public.challenge_versions(challenge_id, version_number desc);

create index if not exists idx_challenge_versions_status
  on public.challenge_versions(status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenge_versions_status_check'
  ) then
    alter table public.challenge_versions
      add constraint challenge_versions_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenge_versions_kind_check'
  ) then
    alter table public.challenge_versions
      add constraint challenge_versions_kind_check
      check (kind in ('code', 'multiple_choice'));
  end if;
end $$;

alter table public.challenges
add column if not exists current_published_version_id uuid;

alter table public.challenges
add column if not exists current_draft_version_id uuid;

alter table public.challenges
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_current_published_version_id_fkey'
  ) then
    alter table public.challenges
      add constraint challenges_current_published_version_id_fkey
      foreign key (current_published_version_id)
      references public.challenge_versions(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_current_draft_version_id_fkey'
  ) then
    alter table public.challenges
      add constraint challenges_current_draft_version_id_fkey
      foreign key (current_draft_version_id)
      references public.challenge_versions(id)
      on delete set null;
  end if;
end $$;

alter table public.submissions
add column if not exists challenge_version_id uuid references public.challenge_versions(id) on delete set null;

create index if not exists idx_submissions_challenge_version_id
  on public.submissions(challenge_version_id);

insert into public.challenge_versions (
  challenge_id,
  version_number,
  status,
  title,
  kind,
  language,
  judge0_language_id,
  reading_mdx,
  prompt_mdx,
  starter_code,
  solution_code,
  hidden_test_code,
  choice_options,
  choice_correct_key,
  choice_explanation_mdx,
  created_at,
  updated_at,
  published_at
)
select
  challenges.id,
  1,
  'published',
  challenges.title,
  coalesce(challenges.kind, 'code'),
  challenges.language,
  challenges.judge0_language_id,
  challenges.reading_mdx,
  coalesce(challenges.prompt_mdx, ''),
  coalesce(challenges.starter_code, ''),
  coalesce(challenges.solution_code, ''),
  coalesce(challenges.hidden_test_code, ''),
  coalesce(challenges.choice_options, '[]'::jsonb),
  challenges.choice_correct_key,
  coalesce(challenges.choice_explanation_mdx, ''),
  now(),
  now(),
  now()
from public.challenges
where not exists (
  select 1
  from public.challenge_versions
  where challenge_versions.challenge_id = challenges.id
);

with latest_published as (
  select distinct on (challenge_id)
    challenge_id,
    id
  from public.challenge_versions
  where status = 'published'
  order by challenge_id, version_number desc
),
latest_draft as (
  select distinct on (challenge_id)
    challenge_id,
    id
  from public.challenge_versions
  where status = 'draft'
  order by challenge_id, version_number desc
)
update public.challenges
set
  current_published_version_id = latest_published.id,
  current_draft_version_id = latest_draft.id,
  published = latest_published.id is not null,
  updated_at = now()
from latest_published
left join latest_draft
  on latest_draft.challenge_id = latest_published.challenge_id
where public.challenges.id = latest_published.challenge_id;

with latest_draft as (
  select distinct on (challenge_id)
    challenge_id,
    id
  from public.challenge_versions
  where status = 'draft'
  order by challenge_id, version_number desc
)
update public.challenges
set
  current_draft_version_id = latest_draft.id,
  updated_at = now()
from latest_draft
where public.challenges.id = latest_draft.challenge_id
  and public.challenges.current_draft_version_id is distinct from latest_draft.id;

update public.submissions
set challenge_version_id = public.challenges.current_published_version_id
from public.challenges
where public.submissions.challenge_id = public.challenges.id
  and public.submissions.challenge_version_id is null;
