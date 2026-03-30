create table if not exists public.challenge_review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  last_result text not null default 'unseen' check (last_result in ('unseen', 'passed', 'failed')),
  success_streak integer not null default 0,
  successful_attempts integer not null default 0,
  failed_attempts integer not null default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  last_submission_id uuid references public.submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create index if not exists idx_challenge_review_state_next_review_at
  on public.challenge_review_state(user_id, next_review_at);

create index if not exists idx_challenge_review_state_last_result
  on public.challenge_review_state(user_id, last_result);
