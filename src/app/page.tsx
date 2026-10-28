"use client";

import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/menu";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { MasonryGrid } from "@/components/masonry-grid";
import { TaskLine } from "@/components/task-line";
import { SwipeRow } from "@/components/swipe-row";
import { Alert, Empty, ItemLabel, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { WEEKDAYS, addDaysIso, todayIso } from "@/lib/labels";
import { HMS_REFRESH, TASK_FIELDS, arrangeTasks, type Task } from "@/lib/task";
type Item = { id: string; name: string; quantity: number | null; unit: string | null; bought: boolean; sort_order: number };
type List = { id: string; name: string; sort_order: number; hms_shop_items: Item[] };
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
        gate!.supabase.from("hms_shop_lists").select("id, name, sort_order, hms_shop_items(id, name, quantity, unit, bought, sort_order)").eq("household_id", gate!.member.household_id).order("sort_order"),
        gate!.supabase.from("hms_classes").select("id, name, starts_at, place, person_id, weekdays, weekday").eq("household_id", gate!.member.household_id).contains("weekdays", [weekday]).eq("active", true).order("starts_at"),
        gate!.supabase.from("hms_people").select("id, name").eq("household_id", gate!.member.household_id),
        gate!.supabase.from("hms_events").select("id, title, event_date, event_time, remind_day_before").eq("household_id", gate!.member.household_id).gte("event_date", today).order("event_date"),
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
      new Notification("מצקה", { body: `מחר: ${event.title}`, icon: "/icon-192.png" });
      localStorage.setItem(key, "1");
    }
  }, [events]);

  if (!gate) return null;
  const loading = !tasks || !lists || !classes || !events;
  const openCount = (tasks ?? []).filter((task) => task.status !== "done").length;
  const shopLists = (lists ?? [])
    .map((list) => ({
      ...list,
      items: [...(list.hms_shop_items ?? [])].sort((a, b) => Number(a.bought) - Number(b.bought) || a.sort_order - b.sort_order),
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

  const visibleTasks = (tasks ?? []).filter((task) => task.status !== "done");
  const visibleShop = shopLists
    .map((list) => ({ ...list, items: list.items.filter((item) => !item.bought) }))
    .filter((list) => list.items.length > 0);
  const hasClasses = (classes?.length ?? 0) > 0;
  const hasEvents = (events?.length ?? 0) > 0;
  const classesCard = (
    <CollapsibleSection
      storageKey="home-classes"
      title={<h2>חוגים היום</h2>}
      action={<Link href="/classes">הכל</Link>}
      className="panel"
    >
      {loading ? <Skeleton rows={2} /> : null}
      {!loading && !hasClasses ? <Empty title="אין חוגים היום" /> : null}
      <ul className="stack">
        {(classes ?? []).map((row) => (
          <li key={row.id} className="spread">
            <span><strong>{row.starts_at.slice(0, 5)}</strong> {row.name}</span>
            <PersonLink id={row.person_id} name={personName(row.person_id)} />
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
  const eventsCard = (
    <CollapsibleSection
      storageKey="home-events"
      title={<h2>אירועים</h2>}
      action={<Link href="/events">הכל</Link>}
      className="panel"
    >
      {loading ? <Skeleton rows={2} /> : null}
      {!loading && !hasEvents ? <Empty title="אין אירועים קרובים" /> : null}
      <ul className="stack">
        {(events ?? []).map((event) => (
          <li key={event.id} className="spread">
            <span>{event.title}</span>
            <span className="meta">{event.event_date.slice(5)}{event.event_time ? ` ${event.event_time.slice(0, 5)}` : ""}</span>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );

  return (
    <>
      <PageHead
        title="היום"
        lede={`${WEEKDAYS[new Date().getDay()]}, ${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(new Date())}`}
      />
      <Alert>{error}</Alert>
      <MasonryGrid>
        {hasClasses ? classesCard : null}
        {hasEvents ? eventsCard : null}
        <CollapsibleSection
          storageKey="home-tasks"
          title={<h2>משימות פתוחות</h2>}
          action={<Link href="/tasks">{openCount}</Link>}
          className="panel panel-tasks"
        >
          {loading ? <Skeleton rows={4} /> : null}
          {!loading && visibleTasks.length === 0 ? (
            <Empty title="אין משימות פתוחות" action={<Link className="btn btn-primary" href="/tasks">הוספת משימה</Link>} />
          ) : null}
          <ul className="stack">
            {visibleTasks.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </ul>
        </CollapsibleSection>

        <CollapsibleSection
          storageKey="home-shop"
          title={<h2>לקנות</h2>}
          action={<Link href="/shop">{pendingCount}</Link>}
          className="panel panel-shop"
        >
          {loading ? <Skeleton rows={3} /> : null}
          {!loading && visibleShop.length === 0 ? (
            <Empty title="הרשימה ריקה" action={<Link className="btn btn-quiet" href="/shop">לקניות</Link>} />
          ) : null}
          {visibleShop.map((list) => (
            <CollapsibleSection
              key={list.id}
              nested
              storageKey={`home-shop-${list.id}`}
              title={<span className="meta">{list.name}</span>}
              action={<span className="meta">{list.items.length}</span>}
            >
              <ul className="stack">
                {list.items.map((item) => (
                  <SwipeRow
                    key={item.id}
                    startActions={[{
                      label: "נקנה",
                      icon: <Check aria-hidden="true" />,
                      onSelect: () => toggleBought(item),
                    }]}
                  >
                    <IconButton label={`סמן את ${item.name} כנקנה`} onClick={() => toggleBought(item)}>
                      <Circle size={18} aria-hidden="true" />
                    </IconButton>
                    <div className="row-open shop-pair">
                      <span className="shop-amount">{formatAmount(item) || "–"}</span>
                      <ItemLabel value={item.name} />
                    </div>
                  </SwipeRow>
                ))}
              </ul>
            </CollapsibleSection>
          ))}
        </CollapsibleSection>

        {hasClasses ? null : classesCard}
        {hasEvents ? null : eventsCard}
      </MasonryGrid>
    </>
  );
}
