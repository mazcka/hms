"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { Empty, PageHead, Skeleton } from "@/components/ui";
import { RELATIONS, WEEKDAYS, WISH_STATUS, eventKindLabel, formatDate, todayIso } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
type ClassRow = { id: string; name: string; weekday: number; weekdays: number[] | null; starts_at: string; place: string | null };
type Kind = { id: string; label: string };
type EventRow = { id: string; title: string; kind: string; event_date: string };
type Wish = { id: string; title: string; status: keyof typeof WISH_STATUS };

function classDays(row: ClassRow) {
  return row.weekdays?.length ? row.weekdays : [row.weekday];
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [person, setPerson] = useState<Person | null>(null);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [missing, setMissing] = useState(false);

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
      if (p.error || c.error || e.error || w.error) showNotice({ tone: "error", text: "לא הצלחנו לטעון את האדם. נסה שוב." });
      const found = (p.data ?? null) as Person | null;
      setPerson(found);
      setMissing(!found);
      setClasses((c.data ?? []) as ClassRow[]);
      setEvents((e.data ?? []) as EventRow[]);
      setWishes((w.data ?? []) as Wish[]);
      setKinds(k.error ? [] : (k.data ?? []) as Kind[]);
    });
    return () => {
      active = false;
    };
  }, [gate, id, showNotice]);

  if (!gate) return null;
  if (!person && !missing && !classes) return <Skeleton rows={4} />;
  if (!person) return <Empty title="האדם לא נמצא" />;

  const today = todayIso();
  const later = (events ?? []).filter((row) => row.event_date >= today);
  const past = (events ?? []).filter((row) => row.event_date < today);
  const openWishes = (wishes ?? []).filter((row) => row.status !== "bought");
  const boughtWishes = (wishes ?? []).filter((row) => row.status === "bought");
  const empty = !(classes?.length || events?.length || wishes?.length);

  return (
    <>
      <PageHead title={person.name} lede={RELATIONS[person.relation]} />
      {empty ? <Empty title="אין עדיין חוגים, אירועים או משאלות" /> : null}
      {classes && classes.length > 0 ? (
        <CollapsibleSection storageKey={`person-${id}-classes`} title={<h2>חוגים</h2>} action={<span className="meta">{classes.length}</span>} className="panel">
          <ul className="stack">
            {classes.map((row) => (
              <li key={row.id} className="record-static">
                <div className="row-open">
                  <span>{row.name}</span>
                  <span className="meta">
                    {classDays(row).map((day) => WEEKDAYS[day]).join(" · ")}
                    {` · ${row.starts_at.slice(0, 5)}`}
                    {row.place ? ` · ${row.place}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
      {later.length > 0 || past.length > 0 ? (
        <CollapsibleSection storageKey={`person-${id}-events`} title={<h2>אירועים</h2>} action={<span className="meta">{later.length + past.length}</span>} className="panel">
          {later.length > 0 ? (
            <ul className="stack">
              {later.map((row) => (
                <li key={row.id} className="record-static">
                  <div className="row-open">
                    <span>{row.title}</span>
                    <span className="meta">{eventKindLabel(row.kind, kinds)} · {formatDate(row.event_date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {past.length > 0 ? (
            <CollapsibleSection nested storageKey={`person-${id}-events-past`} title={<span className="meta">עברו</span>} action={<span className="meta">{past.length}</span>} defaultOpen={false}>
              <ul className="stack">
                {past.map((row) => (
                  <li key={row.id} className="record-static status-settled">
                    <div className="row-open">
                      <span>{row.title}</span>
                      <span className="meta">{eventKindLabel(row.kind, kinds)} · {formatDate(row.event_date)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ) : null}
        </CollapsibleSection>
      ) : null}
      {openWishes.length > 0 || boughtWishes.length > 0 ? (
        <CollapsibleSection storageKey={`person-${id}-wishes`} title={<h2>משאלות</h2>} action={<span className="meta">{openWishes.length + boughtWishes.length}</span>} className="panel">
          {openWishes.length > 0 ? (
            <ul className="stack">
              {openWishes.map((row) => (
                <li key={row.id} className="spread">
                  <span>{row.title}</span>
                  <span className="chip">{WISH_STATUS[row.status]}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {boughtWishes.length > 0 ? (
            <CollapsibleSection nested storageKey={`person-${id}-wishes-bought`} title={<span className="meta">נקנו</span>} action={<span className="meta">{boughtWishes.length}</span>} defaultOpen={false}>
              <ul className="stack">
                {boughtWishes.map((row) => (
                  <li key={row.id} className="spread status-settled">
                    <span className="bought">{row.title}</span>
                    <span className="chip">{WISH_STATUS[row.status]}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ) : null}
        </CollapsibleSection>
      ) : null}
    </>
  );
}
