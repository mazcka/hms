create table public.hms_event_kinds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.hms_households (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (household_id, label)
);

alter table public.hms_events drop constraint if exists hms_events_kind_check;

alter table public.hms_event_kinds enable row level security;

create policy hms_event_kinds_member on public.hms_event_kinds
  for all
  using (private.hms_is_member(household_id))
  with check (private.hms_is_member(household_id));
