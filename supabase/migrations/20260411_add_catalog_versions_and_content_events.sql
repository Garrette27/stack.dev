create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  source_version_id uuid references public.course_versions(id) on delete set null,
  title text not null,
  summary text not null default '',
  difficulty text not null default 'Beginner',
  accent text not null default '#c96f36',
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (course_id, version_number)
);

create index if not exists idx_course_versions_course_id
  on public.course_versions(course_id, version_number desc);

create index if not exists idx_course_versions_status
  on public.course_versions(status);

create table if not exists public.lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  source_version_id uuid references public.lesson_versions(id) on delete set null,
  title text not null,
  summary text not null default '',
  estimated_minutes integer not null default 10,
  body_mdx text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (lesson_id, version_number)
);

create index if not exists idx_lesson_versions_lesson_id
  on public.lesson_versions(lesson_id, version_number desc);

create index if not exists idx_lesson_versions_status
  on public.lesson_versions(status);

create table if not exists public.content_events (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  change_summary text not null,
  from_version_id uuid,
  to_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_events_content
  on public.content_events(content_type, content_id, created_at desc);

create index if not exists idx_content_events_event_type
  on public.content_events(event_type, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_versions_status_check'
  ) then
    alter table public.course_versions
      add constraint course_versions_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesson_versions_status_check'
  ) then
    alter table public.lesson_versions
      add constraint lesson_versions_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_events_content_type_check'
  ) then
    alter table public.content_events
      add constraint content_events_content_type_check
      check (content_type in ('course', 'lesson', 'challenge'));
  end if;
end $$;

alter table public.courses
add column if not exists current_published_version_id uuid;

alter table public.courses
add column if not exists current_draft_version_id uuid;

alter table public.courses
add column if not exists updated_at timestamptz not null default now();

alter table public.lessons
add column if not exists current_published_version_id uuid;

alter table public.lessons
add column if not exists current_draft_version_id uuid;

alter table public.lessons
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_current_published_version_id_fkey'
  ) then
    alter table public.courses
      add constraint courses_current_published_version_id_fkey
      foreign key (current_published_version_id)
      references public.course_versions(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_current_draft_version_id_fkey'
  ) then
    alter table public.courses
      add constraint courses_current_draft_version_id_fkey
      foreign key (current_draft_version_id)
      references public.course_versions(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_current_published_version_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_current_published_version_id_fkey
      foreign key (current_published_version_id)
      references public.lesson_versions(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_current_draft_version_id_fkey'
  ) then
    alter table public.lessons
      add constraint lessons_current_draft_version_id_fkey
      foreign key (current_draft_version_id)
      references public.lesson_versions(id)
      on delete set null;
  end if;
end $$;

alter table public.challenge_versions
drop constraint if exists challenge_versions_kind_check;

alter table public.challenge_versions
add constraint challenge_versions_kind_check
check (kind in ('code', 'multiple_choice', 'local_lab'));

insert into public.course_versions (
  course_id,
  version_number,
  status,
  title,
  summary,
  difficulty,
  accent,
  created_at,
  updated_at,
  published_at
)
select
  courses.id,
  1,
  case when coalesce(courses.published, false) then 'published' else 'draft' end,
  courses.title,
  coalesce(courses.summary, ''),
  coalesce(courses.difficulty, 'Beginner'),
  coalesce(courses.accent, '#c96f36'),
  now(),
  now(),
  case when coalesce(courses.published, false) then now() else null end
from public.courses
where not exists (
  select 1
  from public.course_versions
  where course_versions.course_id = courses.id
);

insert into public.lesson_versions (
  lesson_id,
  version_number,
  status,
  title,
  summary,
  estimated_minutes,
  body_mdx,
  created_at,
  updated_at,
  published_at
)
select
  lessons.id,
  1,
  case when coalesce(lessons.published, false) then 'published' else 'draft' end,
  lessons.title,
  coalesce(lessons.summary, ''),
  coalesce(lessons.estimated_minutes, 10),
  coalesce(lessons.body_mdx, ''),
  now(),
  now(),
  case when coalesce(lessons.published, false) then now() else null end
from public.lessons
where not exists (
  select 1
  from public.lesson_versions
  where lesson_versions.lesson_id = lessons.id
);

with latest_published as (
  select distinct on (course_id)
    course_id,
    id
  from public.course_versions
  where status = 'published'
  order by course_id, version_number desc
),
latest_draft as (
  select distinct on (course_id)
    course_id,
    id
  from public.course_versions
  where status = 'draft'
  order by course_id, version_number desc
)
update public.courses
set
  current_published_version_id = latest_published.id,
  current_draft_version_id = latest_draft.id,
  published = latest_published.id is not null,
  updated_at = now()
from latest_published
left join latest_draft
  on latest_draft.course_id = latest_published.course_id
where public.courses.id = latest_published.course_id;

with latest_draft as (
  select distinct on (course_id)
    course_id,
    id
  from public.course_versions
  where status = 'draft'
  order by course_id, version_number desc
)
update public.courses
set
  current_draft_version_id = latest_draft.id,
  updated_at = now()
from latest_draft
where public.courses.id = latest_draft.course_id
  and public.courses.current_draft_version_id is distinct from latest_draft.id;

with latest_published as (
  select distinct on (lesson_id)
    lesson_id,
    id
  from public.lesson_versions
  where status = 'published'
  order by lesson_id, version_number desc
),
latest_draft as (
  select distinct on (lesson_id)
    lesson_id,
    id
  from public.lesson_versions
  where status = 'draft'
  order by lesson_id, version_number desc
)
update public.lessons
set
  current_published_version_id = latest_published.id,
  current_draft_version_id = latest_draft.id,
  published = latest_published.id is not null,
  updated_at = now()
from latest_published
left join latest_draft
  on latest_draft.lesson_id = latest_published.lesson_id
where public.lessons.id = latest_published.lesson_id;

with latest_draft as (
  select distinct on (lesson_id)
    lesson_id,
    id
  from public.lesson_versions
  where status = 'draft'
  order by lesson_id, version_number desc
)
update public.lessons
set
  current_draft_version_id = latest_draft.id,
  updated_at = now()
from latest_draft
where public.lessons.id = latest_draft.lesson_id
  and public.lessons.current_draft_version_id is distinct from latest_draft.id;
