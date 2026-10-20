create table public.hms_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'בית',
  created_at timestamptz not null default now()
);

create table public.hms_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.hms_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  name text not null,
  relation text not null check (relation in ('daughter', 'classmate', 'other')),
  created_at timestamptz not null default now()
);

create table public.hms_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  due_date date,
  due_time time,
  weekday smallint check (weekday between 0 and 6),
  assignee_id uuid references public.hms_members (id) on delete set null,
  created_by uuid references public.hms_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hms_shop_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.hms_shop_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  list_id uuid not null references public.hms_shop_lists (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  bought boolean not null default false,
  one_off boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.hms_classes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  person_id uuid not null references public.hms_people (id) on delete cascade,
  name text not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time,
  place text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.hms_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  title text not null,
  kind text not null default 'other' check (kind in ('birthday', 'appointment', 'other')),
  event_date date not null,
  event_time time,
  person_id uuid references public.hms_people (id) on delete set null,
  place text,
  notes text,
  remind_day_before boolean not null default true,
  created_by uuid references public.hms_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hms_wishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  title text not null,
  for_person_id uuid references public.hms_people (id) on delete set null,
  for_label text,
  url text,
  notes text,
  priority smallint not null default 0,
  status text not null default 'idea' check (status in ('idea', 'planned', 'bought')),
  created_by uuid references public.hms_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hms_voice_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  member_id uuid references public.hms_members (id) on delete set null,
  transcript text not null,
  extracted jsonb not null,
  status text not null check (status in ('approved', 'rejected')),
  target_table text,
  target_id uuid,
  created_at timestamptz not null default now()
);

alter table public.hms_households enable row level security;
alter table public.hms_members enable row level security;
alter table public.hms_people enable row level security;
alter table public.hms_tasks enable row level security;
alter table public.hms_shop_lists enable row level security;
alter table public.hms_shop_items enable row level security;
alter table public.hms_classes enable row level security;
alter table public.hms_events enable row level security;
alter table public.hms_wishes enable row level security;
alter table public.hms_voice_logs enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.hms_is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hms_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
  );
$$;

revoke all on function private.hms_is_member(uuid) from public;
grant execute on function private.hms_is_member(uuid) to anon, authenticated, service_role;

create policy hms_households_member on public.hms_households
  for all
  using (private.hms_is_member(id))
  with check (private.hms_is_member(id));

create policy hms_members_member on public.hms_members
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_people_member on public.hms_people
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_tasks_member on public.hms_tasks
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_shop_lists_member on public.hms_shop_lists
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_shop_items_member on public.hms_shop_items
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_classes_member on public.hms_classes
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_events_member on public.hms_events
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_wishes_member on public.hms_wishes
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));

create policy hms_voice_logs_member on public.hms_voice_logs
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));
