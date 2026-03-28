create table if not exists public.page_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  path text not null,
  referrer text,
  ip_hash text,
  country text,
  region text,
  city text,
  device_type text,
  browser text,
  operating_system text,
  metadata jsonb not null default '{}'::jsonb,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_page_visits_viewed_at on public.page_visits(viewed_at desc);
create index if not exists idx_page_visits_path on public.page_visits(path);
create index if not exists idx_page_visits_country on public.page_visits(country);

alter table public.page_visits enable row level security;
