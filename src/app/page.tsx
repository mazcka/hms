"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/auth-provider";
import { TaskLine } from "@/components/task-line";
import { Alert, Empty, PersonLink } from "@/components/ui";
import { WEEKDAYS, addDaysIso, todayIso } from "@/lib/labels";
import { HMS_REFRESH, TASK_FIELDS, arrangeTasks, type Task } from "@/lib/task";
type Item = { id: string; name: string; quantity: number | null; unit: string | null; bought: boolean };
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
    function load() {
      const today = todayIso();
      const weekday = new Date().getDay();
      Promise.all([
        gate!.supabase.from("hms_tasks").select(TASK_FIELDS).eq("household_id", gate!.member.household_id),
        gate!.supabase.from("hms_shop_lists").select("id, name, hms_shop_items(id, name, quantity, unit, bought)").eq("household_id", gate!.member.household_id).order("name"),
        gate!.supabase.from("hms_classes").select("id, name, starts_at, place, person_id, weekdays, weekday").eq("household_id", gate!.member.household_id).contains("weekdays", [weekday]).eq("active", true).order("starts_at"),
        gate!.supabase.from("hms_people").select("id, name").eq("household_id", gate!.member.household_id),
        gate!.supabase.from("hms_events").select("id, title, event_date, event_time, remind_day_before").eq("household_id", gate!.member.household_id).gte("event_date", today).order("event_date").limit(8),
      ]).then(([t, s, c, p, e]) => {
        if (!active) return;
        const message = t.error?.message || s.error?.message || c.error?.message || p.error?.message || e.error?.message;
        if (message) setError(message);
        setTasks(arrangeTasks((t.data ?? []) as Task[]));
        setLists((s.data ?? []) as List[]);
        setClasses((c.data ?? []) as ClassRow[]);
        setPeople((p.data ?? []) as Person[]);
        setEvents((e.data ?? []) as EventRow[]);
      });
    }
    load();
    window.addEventListener(HMS_REFRESH, load);
    return () => {
      active = false;
      window.removeEventListener(HMS_REFRESH, load);
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
  const openCount = (tasks ?? []).filter((task) => task.status !== "done").length;
  const shopLists = (lists ?? [])
    .map((list) => ({
      ...list,
      items: [...(list.hms_shop_items ?? [])].sort((a, b) => Number(a.bought) - Number(b.bought)),
    }))
    .filter((list) => list.items.length > 0);
  const pendingCount = shopLists.reduce((n, list) => n + list.items.filter((item) => !item.bought).length, 0);
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "";

  function formatAmount(item: Item) {
    if (item.quantity != null && item.unit) return `${item.quantity} ${item.unit}`;
    if (item.quantity != null) return String(item.quantity);
    return item.unit ?? "";
  }

  async function toggleBought(item: Item) {
    if (!gate) return;
    const bought = !item.bought;
    setLists((current) =>
      (current ?? []).map((list) => ({
        ...list,
        hms_shop_items: (list.hms_shop_items ?? []).map((row) =>
          row.id === item.id ? { ...row, bought } : row,
        ),
      })),
    );
    const { error: writeError } = await gate.supabase.from("hms_shop_items").update({ bought }).eq("id", item.id);
    if (writeError) setError(writeError.message);
  }

  return (
    <>
      <header className="week-hero">
        <div>
          <p className="eyebrow">משק הבית</p>
          <h1>השבוע</h1>
          <p className="lede">היום {WEEKDAYS[new Date().getDay()]}.</p>
        </div>
        {!loading ? (
          <div className="pills" aria-label="סיכום">
            <span className="pill">{openCount} משימות</span>
            <span className="pill">{shopLists.filter((list) => list.items.some((item) => !item.bought)).length} רשימות</span>
            <span className="pill">{classes?.length ?? 0} חוגים</span>
          </div>
        ) : null}
      </header>
      <nav className="mosaic" aria-label="מודולים">
        <Link className="tile tile-tasks" href="/tasks"><span>פתוחות</span>{loading ? "–" : openCount} משימות</Link>
        <Link className="tile tile-shop" href="/shop"><span>מחכה</span>{pendingCount} פריטים</Link>
        <Link className="tile tile-plan" href="/classes"><span>היום</span>{classes?.length ?? "–"} חוגים</Link>
        <Link className="tile tile-people" href="/events"><span>קרובים</span>{events?.length ?? "–"} אירועים</Link>
        <Link className="tile tile-wishes" href="/wishes"><span>רשימה</span>משאלות</Link>
      </nav>
      <Alert>{error}</Alert>
      {loading ? <p>טוען…</p> : null}

      <section className="card tone tone-tasks">
        <div className="spread">
          <h2>משימות</h2>
          <Link href="/tasks">הכל</Link>
        </div>
        {!loading && tasks?.length === 0 ? <Empty title="אין משימות" /> : null}
        <ul className="stack">
          {(tasks ?? []).map((task) => (
            <TaskLine key={task.id} task={task} />
          ))}
        </ul>
      </section>

      <section className="card tone tone-shop">
        <div className="spread">
          <h2>קניות</h2>
          <Link href="/shop">הכל</Link>
        </div>
        {!loading && shopLists.length === 0 ? <Empty title="אין פריטים" /> : null}
        {shopLists.map((list) => (
          <div key={list.id}>
            <strong>{list.name}</strong>
            <ul className="stack">
              {list.items.map((item) => (
                <li key={item.id}>
                  <button
                    className="shop-line"
                    type="button"
                    aria-pressed={item.bought}
                    aria-label={item.bought ? `בטל סימון של ${item.name}` : `סמן את ${item.name} כנקנה`}
                    onClick={() => toggleBought(item)}
                  >
                    <span className="shop-amount">{formatAmount(item) || "–"}</span>
                    <span className={item.bought ? "shop-line-name bought" : "shop-line-name"}>{item.name}</span>
                    <svg className="shop-line-check" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 12.5 4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={item.bought ? 1 : 0.28} />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="card tone tone-classes">
        <div className="spread">
          <h2>חוגים היום</h2>
          <Link href="/classes">הכל</Link>
        </div>
        {!loading && classes?.length === 0 ? <Empty title="אין חוגים היום" /> : null}
        <ul className="stack">
          {(classes ?? []).map((row) => (
            <li key={row.id} className="spread">
              <span>{row.starts_at.slice(0, 5)} · {row.name}{row.place ? ` · ${row.place}` : ""}</span>
              <PersonLink id={row.person_id} name={personName(row.person_id)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card tone tone-events">
        <div className="spread">
          <h2>אירועים</h2>
          <Link href="/events">הכל</Link>
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
