alter table public.hms_classes
  add column if not exists weekdays smallint[] not null default '{}';

update public.hms_classes
set weekdays = array[weekday]::smallint[]
where cardinality(weekdays) = 0;

alter table public.hms_classes drop constraint if exists hms_classes_weekdays_check;

alter table public.hms_classes
  add constraint hms_classes_weekdays_check
  check (
    cardinality(weekdays) > 0
    and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );
