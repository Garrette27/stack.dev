alter table public.challenges
add column if not exists kind text not null default 'code';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_kind_check'
  ) then
    alter table public.challenges
      add constraint challenges_kind_check
      check (kind in ('code', 'multiple_choice'));
  end if;
end $$;

alter table public.challenges
add column if not exists choice_options jsonb not null default '[]'::jsonb;

alter table public.challenges
add column if not exists choice_correct_key text;

alter table public.challenges
add column if not exists choice_explanation_mdx text not null default '';

alter table public.challenges
alter column language drop not null;

alter table public.challenges
alter column judge0_language_id drop not null;

update public.challenges
set
  kind = coalesce(kind, 'code'),
  choice_options = coalesce(choice_options, '[]'::jsonb),
  choice_explanation_mdx = coalesce(choice_explanation_mdx, '')
where
  kind is null
  or choice_options is null
  or choice_explanation_mdx is null;
