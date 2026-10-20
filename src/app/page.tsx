"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";
import { WEEKDAYS, addDaysIso, todayIso } from "@/lib/labels";

type Task = { id: string; title: string; status: string; due_date: string | null };
type Item = { id: string; name: string; bought: boolean };
type List = { id: string; name: string; hms_shop_items: Item[] };
type ClassRow = { id: string; name: string; starts_at: string; place: string | null; person_id: string };
type Person = { id: string; name: string };
type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  remind_day_before: boolean;
};

export default function WeekPage() {
  const gate = useHousehold();
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    if (!gate) return;
    let active = true;
    const today = todayIso();
    const weekday = new Date().getDay();
    Promise.all([
      gate.supabase.from("hms_tasks").select("id, title, status, due_date").eq("household_id", gate.member.household_id).neq("status", "done").order("due_date", { ascending: true }),
      gate.supabase.from("hms_shop_lists").select("id, name, hms_shop_items(id, name, bought)").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_classes").select("id, name, starts_at, place, person_id").eq("household_id", gate.member.household_id).eq("weekday", weekday).eq("active", true).order("starts_at"),
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id),
      gate.supabase.from("hms_events").select("id, title, event_date, event_time, remind_day_before").eq("household_id", gate.member.household_id).gte("event_date", today).order("event_date").limit(8),
    ]).then(([t, s, c, p, e]) => {
      if (!active) return;
      const message = t.error?.message || s.error?.message || c.error?.message || p.error?.message || e.error?.message;
      if (message) setError(message);
      setTasks((t.data ?? []) as Task[]);
      setLists((s.data ?? []) as List[]);
      setClasses((c.data ?? []) as ClassRow[]);
      setPeople((p.data ?? []) as Person[]);
      setEvents((e.data ?? []) as EventRow[]);
    });
    return () => {
      active = false;
    };
  }, [gate]);

  useEffect(() => {
    if (!events || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const tomorrow = addDaysIso(todayIso(), 1);
    for (const event of events) {
      if (!event.remind_day_before || event.event_date !== tomorrow) continue;
      const key = `hms-remind-${event.id}-${tomorrow}`;
      if (localStorage.getItem(key)) continue;
      new Notification("בית", { body: `מחר: ${event.title}` });
      localStorage.setItem(key, "1");
    }
  }, [events]);

  if (!gate) return null;
  const loading = !tasks || !lists || !classes || !events;
  const openLists = (lists ?? []).map((list) => ({
    ...list,
    pending: (list.hms_shop_items ?? []).filter((item) => !item.bought),
  })).filter((list) => list.pending.length > 0);
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "";

  return (
    <>
      <h1>השבוע</h1>
      <p className="lede">היום {WEEKDAYS[new Date().getDay()]}.</p>
      <Alert>{error}</Alert>
      {loading ? <p>טוען…</p> : null}

      <section className="card">
        <div className="spread">
          <h2>משימות פתוחות</h2>
          <Link href="/tasks">לכל המשימות</Link>
        </div>
        {!loading && tasks?.length === 0 ? <Empty title="אין משימות פתוחות" hint="אפשר להוסיף משימת בית ידנית." /> : null}
        <ul className="stack">
          {(tasks ?? []).map((task) => (
            <li key={task.id}>
              {task.title}
              {task.due_date ? <span className="meta"> · {task.due_date}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="spread">
          <h2>קניות שלא נלקחו</h2>
          <Link href="/shop">לקניות</Link>
        </div>
        {!loading && openLists.length === 0 ? <Empty title="אין פריטים שמחכים" /> : null}
        {openLists.map((list) => (
          <div key={list.id}>
            <strong>{list.name}</strong>
            <ul>
              {list.pending.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="spread">
          <h2>חוגים היום</h2>
          <Link href="/classes">ללוח החוגים</Link>
        </div>
        {!loading && classes?.length === 0 ? <Empty title="אין חוגים היום" /> : null}
        <ul className="stack">
          {(classes ?? []).map((row) => (
            <li key={row.id}>
              {row.starts_at.slice(0, 5)} · {row.name}
              {personName(row.person_id) ? ` · ${personName(row.person_id)}` : ""}
              {row.place ? ` · ${row.place}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="spread">
          <h2>אירועים קרובים</h2>
          <Link href="/events">לאירועים</Link>
        </div>
        {!loading && events?.length === 0 ? <Empty title="אין אירועים קרובים" /> : null}
        <ul className="stack">
          {(events ?? []).map((event) => (
            <li key={event.id}>
              {event.event_date}
              {event.event_time ? ` ${event.event_time.slice(0, 5)}` : ""} · {event.title}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
