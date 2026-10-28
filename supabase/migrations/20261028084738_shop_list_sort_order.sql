alter table public.hms_shop_lists
  add column if not exists sort_order bigint;

with ranked as (
  select
    id,
    row_number() over (
      partition by household_id
      order by name, created_at, id
    ) * 1000 as position
  from public.hms_shop_lists
)
update public.hms_shop_lists as list
set sort_order = ranked.position
from ranked
where list.id = ranked.id
  and list.sort_order is null;

create or replace function private.hms_set_shop_list_sort_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    select coalesce(max(list.sort_order), 0) + 1000
    into new.sort_order
    from public.hms_shop_lists as list
    where list.household_id = new.household_id;
  end if;
  return new;
end;
$$;

revoke all on function private.hms_set_shop_list_sort_order() from public, anon, authenticated;

drop trigger if exists hms_shop_lists_set_sort_order on public.hms_shop_lists;

create trigger hms_shop_lists_set_sort_order
before insert on public.hms_shop_lists
for each row execute function private.hms_set_shop_list_sort_order();

alter table public.hms_shop_lists
  alter column sort_order set not null;
