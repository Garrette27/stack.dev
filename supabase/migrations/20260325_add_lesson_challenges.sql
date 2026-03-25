create table if not exists public.lesson_challenges (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  order_index integer not null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, challenge_id),
  unique (lesson_id, order_index)
);

create index if not exists idx_lesson_challenges_lesson_id
  on public.lesson_challenges(lesson_id, order_index);

create index if not exists idx_lesson_challenges_challenge_id
  on public.lesson_challenges(challenge_id);

insert into public.lesson_challenges (lesson_id, challenge_id, order_index)
select lessons.id, challenges.id, 1
from public.lessons
join public.challenges on public.challenges.slug = public.lessons.challenge_slug
where public.lessons.challenge_slug is not null
on conflict (lesson_id, challenge_id) do nothing;
