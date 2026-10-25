"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";
import { EVENT_KINDS, RELATIONS, WEEKDAYS, WISH_STATUS } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
type ClassRow = { id: string; name: string; weekday: number; weekdays: number[] | null; starts_at: string; place: string | null };
type EventRow = { id: string; title: string; kind: keyof typeof EVENT_KINDS; event_date: string };
type Wish = { id: string; title: string; status: keyof typeof WISH_STATUS };

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const gate = useHousehold();
  const [person, setPerson] = useState<Person | null>(null);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
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
    ]).then(([p, c, e, w]) => {
      if (!active) return;
      setError(p.error?.message || c.error?.message || e.error?.message || w.error?.message || "");
      setPerson((p.data ?? null) as Person | null);
      setClasses((c.data ?? []) as ClassRow[]);
      setEvents((e.data ?? []) as EventRow[]);
      setWishes((w.data ?? []) as Wish[]);
    });
    return () => {
      active = false;
    };
  }, [gate, id]);

  if (!gate) return null;
  if (!person && !error && !classes) return <p>טוען…</p>;
  if (!person) return <Empty title="האדם לא נמצא" />;

  return (
    <>
      <p className="eyebrow">{RELATIONS[person.relation]}</p>
      <h1>{person.name}</h1>
      <Alert>{error}</Alert>
      <section className="card tone tone-classes">
        <h2>חוגים</h2>
        {classes?.length === 0 ? <Empty title="אין חוגים" /> : null}
        <ul className="stack">
          {classes?.map((row) => (
            <li key={row.id}>{(row.weekdays?.length ? row.weekdays : [row.weekday]).map((day) => WEEKDAYS[day]).join(", ")} · {row.starts_at.slice(0, 5)} · {row.name}</li>
          ))}
        </ul>
      </section>
      <section className="card tone tone-events">
        <h2>אירועים</h2>
        {events?.length === 0 ? <Empty title="אין אירועים" /> : null}
        <ul className="stack">
          {events?.map((row) => (
            <li key={row.id}>{row.event_date} · {row.title}</li>
          ))}
        </ul>
      </section>
      <section className="card tone tone-wishes">
        <h2>משאלות</h2>
        {wishes?.length === 0 ? <Empty title="אין משאלות" /> : null}
        <ul className="stack">
          {wishes?.map((row) => (
            <li key={row.id} className="spread">
              <span>{row.title}</span>
              <span className="chip">{WISH_STATUS[row.status]}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
