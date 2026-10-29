create table public.hms_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  member_id uuid not null references public.hms_members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hms_push_sent (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  kind text not null check (kind in ('event', 'class', 'task')),
  entity_id uuid not null,
  slot date not null,
  created_at timestamptz not null default now(),
  unique (kind, entity_id, slot)
);

alter table public.hms_push_subscriptions enable row level security;
alter table public.hms_push_sent enable row level security;

create policy hms_push_subscriptions_own on public.hms_push_subscriptions
  for all
  using (member_id in (select id from public.hms_members where user_id = auth.uid()))
  with check (
    member_id in (select id from public.hms_members where user_id = auth.uid())
    and household_id in (select household_id from public.hms_members where user_id = auth.uid())
  );
