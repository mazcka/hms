update public.hms_people set relation = 'other' where relation = 'classmate';

alter table public.hms_people drop constraint if exists hms_people_relation_check;

alter table public.hms_people
  add constraint hms_people_relation_check
  check (relation in ('daughter', 'partner', 'other'));
