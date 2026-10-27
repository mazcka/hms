alter table public.hms_shop_items
  add column if not exists sort_order bigint;

with ranked as (
  select
    id,
    row_number() over (
      partition by list_id
      order by bought, created_at, id
    ) * 1000 as position
  from public.hms_shop_items
)
update public.hms_shop_items as item
set sort_order = ranked.position
from ranked
where item.id = ranked.id
  and item.sort_order is null;

create or replace function private.hms_set_shop_item_sort_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    select coalesce(max(item.sort_order), 0) + 1000
    into new.sort_order
    from public.hms_shop_items as item
    where item.list_id = new.list_id;
  end if;
  return new;
end;
$$;

revoke all on function private.hms_set_shop_item_sort_order() from public, anon, authenticated;

drop trigger if exists hms_shop_items_set_sort_order on public.hms_shop_items;

create trigger hms_shop_items_set_sort_order
before insert on public.hms_shop_items
for each row execute function private.hms_set_shop_item_sort_order();

alter table public.hms_shop_items
  alter column sort_order set not null;

create or replace function public.hms_swap_shop_items(first_id uuid, second_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  first_order bigint;
  second_order bigint;
  shared_list_id uuid;
begin
  select first_item.sort_order, second_item.sort_order, first_item.list_id
  into first_order, second_order, shared_list_id
  from public.hms_shop_items as first_item
  join public.hms_shop_items as second_item
    on second_item.id = second_id
   and second_item.list_id = first_item.list_id
   and second_item.household_id = first_item.household_id
  where first_item.id = first_id
    and private.hms_is_member(first_item.household_id)
  for update of first_item, second_item;

  if shared_list_id is null then
    raise exception 'Shopping items must belong to the same accessible list';
  end if;

  update public.hms_shop_items
  set sort_order = case id
    when first_id then second_order
    when second_id then first_order
  end
  where id in (first_id, second_id);
end;
$$;

revoke all on function public.hms_swap_shop_items(uuid, uuid) from public, anon;
grant execute on function public.hms_swap_shop_items(uuid, uuid) to authenticated;
