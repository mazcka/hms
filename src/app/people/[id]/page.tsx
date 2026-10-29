"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { Alert, Empty, Loader, PageHead } from "@/components/ui";
import { RELATIONS, WEEKDAYS, WISH_STATUS, eventKindLabel, formatDate } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
type ClassRow = { id: string; name: string; weekday: number; weekdays: number[] | null; starts_at: string; place: string | null };
type Kind = { id: string; label: string };
type EventRow = { id: string; title: string; kind: string; event_date: string };
type Wish = { id: string; title: string; status: keyof typeof WISH_STATUS };

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const gate = useHousehold();
  const [person, setPerson] = useState<Person | null>(null);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gate || !id) return;
    let active = true;
    Promise.all([
      gate.supabase.from("hms_people").select("id, name, relation").eq("id", id).maybeSingle(),
      gate.supabase.from("hms_classes").select("id, name, weekday, weekdays, starts_at, place").eq("person_id", id).order("starts_at"),
      gate.supabase.from("hms_events").select("id, title, kind, event_date").eq("person_id", id).order("event_date"),
      gate.supabase.from("hms_wishes").select("id, title, status").eq("for_person_id", id),
      gate.supabase.from("hms_event_kinds").select("id, label").eq("household_id", gate.member.household_id),
    ]).then(([p, c, e, w, k]) => {
      if (!active) return;
      setError(p.error?.message || c.error?.message || e.error?.message || w.error?.message || "");
      setPerson((p.data ?? null) as Person | null);
      setClasses((c.data ?? []) as ClassRow[]);
      setEvents((e.data ?? []) as EventRow[]);
      setWishes((w.data ?? []) as Wish[]);
      setKinds(k.error ? [] : (k.data ?? []) as Kind[]);
    });
    return () => {
      active = false;
    };
  }, [gate, id]);

  if (!gate) return null;
  if (!person && !error && !classes) return <Loader />;
  if (!person) return <Empty title="האדם לא נמצא" />;

  return (
    <>
      <PageHead title={person.name} lede={RELATIONS[person.relation]} />
      <Alert>{error}</Alert>
      <CollapsibleSection storageKey={`person-${id}-classes`} title={<h2>חוגים</h2>} className="tone tone-classes">
        {classes?.length === 0 ? <Empty title="אין חוגים" /> : null}
        <ul className="stack">
          {classes?.map((row) => (
            <li key={row.id}>{(row.weekdays?.length ? row.weekdays : [row.weekday]).map((day) => WEEKDAYS[day]).join(", ")} · {row.starts_at.slice(0, 5)} · {row.name}</li>
          ))}
        </ul>
      </CollapsibleSection>
      <CollapsibleSection storageKey={`person-${id}-events`} title={<h2>אירועים</h2>} className="tone tone-events">
        {events?.length === 0 ? <Empty title="אין אירועים" /> : null}
        <ul className="stack">
          {events?.map((row) => (
            <li key={row.id}>{formatDate(row.event_date)} · {eventKindLabel(row.kind, kinds)} · {row.title}</li>
          ))}
        </ul>
      </CollapsibleSection>
      <CollapsibleSection storageKey={`person-${id}-wishes`} title={<h2>משאלות</h2>} className="tone tone-wishes">
        {wishes?.length === 0 ? <Empty title="אין משאלות" /> : null}
        <ul className="stack">
          {wishes?.map((row) => (
            <li key={row.id} className={`spread status-${row.status === "bought" ? "settled" : row.status === "planned" ? "active" : "quiet"}`}>
              <span>{row.title}</span>
              <span className="chip">{WISH_STATUS[row.status]}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </>
  );
}
