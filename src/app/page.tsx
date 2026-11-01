"use client";

import { Calendar, CalendarDays, Check, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { IconButton, MenuItem, RowMenu } from "@/components/menu";
import { PlaceNav } from "@/components/place-nav";
import { Sheet } from "@/components/sheet";
import { TaskLine } from "@/components/task-line";
import { SwipeRow } from "@/components/swipe-row";
import { Alert, Empty, ItemLabel, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { classDays } from "@/components/weekday-picker";
import { WEEKDAYS, addDaysIso, eventKindLabel, formatDate, todayIso } from "@/lib/labels";
import { HMS_REFRESH, TASK_FIELDS, arrangeTasks, notifyRefresh, type Task } from "@/lib/task";
type Item = { id: string; name: string; quantity: number | null; unit: string | null; bought: boolean; one_off: boolean; sort_order: number };
type ShopEdit = { id: string; name: string; quantity: string; oneOff: boolean; listId: string };
type List = { id: string; name: string; sort_order: number; hms_shop_items: Item[] };
type ClassRow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  place: string | null;
  person_id: string;
  weekday: number;
  weekdays: number[] | null;
};
type Person = { id: string; name: string };
type Kind = { id: string; label: string };
type EventRow = {
  id: string;
  title: string;
  kind: string;
  event_date: string;
  event_time: string | null;
  person_id: string | null;
  place: string | null;
  notes: string | null;
  remind_day_before: boolean;
};
type Peek = { kind: "class"; row: ClassRow } | { kind: "event"; row: EventRow };

export default function WeekPage() {
  const gate = useHousehold();
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const { showNotice } = useActionNotice();
  const [editing, setEditing] = useState<ShopEdit | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);

  useEffect(() => {
    if (!gate) return;
    let active = true;
    function load() {
      const today = todayIso();
      const weekday = new Date().getDay();
      Promise.all([
        gate!.supabase.from("hms_tasks").select(TASK_FIELDS).eq("household_id", gate!.member.household_id),
        gate!.supabase.from("hms_shop_lists").select("id, name, sort_order, hms_shop_items(id, name, quantity, unit, bought, one_off, sort_order)").eq("household_id", gate!.member.household_id).order("sort_order"),
        gate!.supabase.from("hms_classes").select("id, name, starts_at, ends_at, place, person_id, weekdays, weekday").eq("household_id", gate!.member.household_id).contains("weekdays", [weekday]).eq("active", true).order("starts_at"),
        gate!.supabase.from("hms_people").select("id, name").eq("household_id", gate!.member.household_id),
        gate!.supabase.from("hms_events").select("id, title, kind, event_date, event_time, person_id, place, notes, remind_day_before").eq("household_id", gate!.member.household_id).gte("event_date", today).order("event_date"),
        gate!.supabase.from("hms_event_kinds").select("id, label").eq("household_id", gate!.member.household_id),
      ]).then(([t, s, c, p, e, k]) => {
        if (!active) return;
        const message = t.error?.message || s.error?.message || c.error?.message || p.error?.message || e.error?.message;
        if (message) setError(message);
        setTasks(arrangeTasks((t.data ?? []) as Task[]));
        setLists((s.data ?? []) as List[]);
        setClasses((c.data ?? []) as ClassRow[]);
        setPeople((p.data ?? []) as Person[]);
        setEvents((e.data ?? []) as EventRow[]);
        setKinds(k.error ? [] : (k.data ?? []) as Kind[]);
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

  function applyBought(item: Item, bought: boolean) {
    setLists((current) =>
      (current ?? []).map((list) => ({
        ...list,
        hms_shop_items: (list.hms_shop_items ?? []).map((row) =>
          row.id === item.id ? { ...row, bought } : row,
        ),
      })),
    );
  }

  async function toggleBought(item: Item) {
    if (!gate) return;
    const bought = !item.bought;
    applyBought(item, bought);
    const { error: writeError } = await gate.supabase.from("hms_shop_items").update({ bought }).eq("id", item.id);
    if (writeError) {
      applyBought(item, item.bought);
      showNotice({ tone: "error", text: "לא הצלחנו לעדכן את הפריט. נסה שוב." });
      return;
    }
    showNotice({
      tone: "ok",
      text: bought ? `${item.name} סומן כנקנה.` : `${item.name} חזר לרשימה.`,
      undo: () => toggleBought({ ...item, bought }),
    });
    notifyRefresh();
  }

  function startEdit(item: Item, listId: string) {
    setEditing({
      id: item.id,
      name: item.name,
      quantity: item.quantity == null ? "" : String(item.quantity),
      oneOff: item.one_off,
      listId,
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!gate || !editing) return;
    const name = editing.name.trim();
    const rawQuantity = editing.quantity.replace(",", ".").trim();
    const quantity = rawQuantity === "" ? null : Number(rawQuantity);
    if (!name || !editing.listId || (quantity != null && !Number.isFinite(quantity))) {
      setError("חסרים שם או קטגוריה.");
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_shop_items").update({
      name,
      quantity,
      one_off: editing.oneOff,
      list_id: editing.listId,
    }).eq("id", editing.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור את השינוי. נסה שוב." });
    else {
      setEditing(null);
      showNotice({ tone: "ok", text: `${name} עודכן.` });
      notifyRefresh();
    }
  }

  async function removeItem(item: Item) {
    if (!gate || !window.confirm(`למחוק את "${item.name}" מהרשימה?`)) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_items").delete().eq("id", item.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק את הפריט. נסה שוב." });
    else {
      showNotice({ tone: "ok", text: `${item.name} נמחק מהרשימה.` });
      notifyRefresh();
    }
  }

  const visibleTasks = (tasks ?? []).filter((task) => task.status !== "done");
  const activeTasks = visibleTasks.filter((task) => task.status === "in_progress");
  const openTasks = visibleTasks.filter((task) => task.status === "open");
  const visibleShop = shopLists
    .map((list) => ({ ...list, items: list.items.filter((item) => !item.bought) }))
    .filter((list) => list.items.length > 0);
  const today = todayIso();
  const todayEvents = (events ?? []).filter((event) => event.event_date === today);
  const laterEvents = (events ?? []).filter((event) => event.event_date !== today);
  const visibleLaterEvents = laterEvents.slice(0, 3);
  const moreLaterCount = laterEvents.length - visibleLaterEvents.length;
  const scheduleCount = (classes?.length ?? 0) + todayEvents.length;
  const nowItems = [
    ...(classes ?? []).map((row) => ({ kind: "class" as const, row, sort: row.starts_at })),
    ...todayEvents.map((row) => ({ kind: "event" as const, row, sort: row.event_time ?? "99:99" })),
  ].sort((a, b) => a.sort.localeCompare(b.sort));
  const overviewTitle = loading
    ? "מארגנים את היום…"
    : scheduleCount === 0
      ? "היום נראה רגוע"
      : scheduleCount === 1
        ? "יש היום דבר אחד ביומן"
        : `יש היום ${scheduleCount} דברים ביומן`;
  const overviewLede = loading
    ? "עוד רגע הכול יהיה במקום."
    : openCount === 0 && pendingCount === 0
      ? "אין משימות או קניות פתוחות. הכול בשליטה."
      : `${openCount === 1 ? "משימה אחת" : `${openCount} משימות`} ו־${pendingCount === 1 ? "פריט אחד" : `${pendingCount} פריטים`} לקנייה מחכים לך.`;
  const eventsCard = (
    <CollapsibleSection
      storageKey="home-events"
      title={<h2>בהמשך</h2>}
      action={<Link href="/events" aria-label="לכל האירועים">הכל</Link>}
      className="panel home-later"
    >
      {loading ? <Skeleton rows={2} /> : null}
      {!loading && laterEvents.length === 0 ? <Empty title="אין אירועים בהמשך" /> : null}
      <ul className="stack">
        {visibleLaterEvents.map((event) => (
          <li key={event.id}>
            <button className="row-line row-line-fill spread" type="button" onClick={() => setPeek({ kind: "event", row: event })}>
              <span className="row-mark" aria-hidden="true"><Calendar /></span>
              <span>{event.title}</span>
              <span className="meta">{event.event_date.slice(8, 10)}/{event.event_date.slice(5, 7)}{event.event_time ? ` ${event.event_time.slice(0, 5)}` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      {moreLaterCount > 0 ? (
        <Link className="home-later-more" href="/events">עוד {moreLaterCount} אירועים</Link>
      ) : null}
    </CollapsibleSection>
  );

  return (
    <>
      <PageHead
        title="היום"
        lede={`${WEEKDAYS[new Date().getDay()]}, ${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(new Date())}`}
      />
      <Alert>{error}</Alert>
      <section className="home-overview" aria-labelledby="home-overview-title">
        <h2 id="home-overview-title">{overviewTitle}</h2>
        <p>{overviewLede}</p>
      </section>
      <div className="home-board">
        {loading || nowItems.length > 0 ? (
          <section className="home-now" aria-labelledby="home-now-title">
            <h2 id="home-now-title">עכשיו</h2>
            {loading ? <Skeleton rows={2} /> : null}
            <ul className="stack">
              {nowItems.map((item) => (
                <li key={`${item.kind}-${item.row.id}`} className="spread">
                  <button
                    className="row-line"
                    type="button"
                    onClick={() => setPeek(item.kind === "class" ? { kind: "class", row: item.row } : { kind: "event", row: item.row })}
                  >
                    <span className="row-mark" aria-hidden="true">
                      {item.kind === "class" ? <CalendarDays /> : <Calendar />}
                    </span>
                    <span>
                      <strong>{item.sort === "99:99" ? "היום" : item.sort.slice(0, 5)}</strong>
                      {" "}
                      {item.kind === "class" ? item.row.name : item.row.title}
                    </span>
                  </button>
                  {item.kind === "class" ? <PersonLink id={item.row.person_id} name={personName(item.row.person_id)} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {loading || laterEvents.length > 0 ? (
          <div className="home-board-row home-board-row-single">
            {eventsCard}
          </div>
        ) : null}
        <div className="home-board-row">
          <CollapsibleSection
            storageKey="home-tasks"
            title={<h2>משימות</h2>}
            action={<Link href="/tasks">{openCount}</Link>}
            className="panel panel-tasks"
          >
            {loading ? <Skeleton rows={4} /> : null}
            {!loading && visibleTasks.length === 0 ? (
              <Empty title="אין משימות פתוחות" action={<Link className="btn btn-primary" href="/tasks">הוספת משימה</Link>} />
            ) : null}
            {activeTasks.length > 0 ? (
              <CollapsibleSection nested storageKey="home-tasks-active" title={<span className="meta">בטיפול</span>} action={<span className="meta">{activeTasks.length}</span>}>
                <ul className="stack">
                  {activeTasks.map((task) => (
                    <TaskLine key={task.id} task={task} />
                  ))}
                </ul>
              </CollapsibleSection>
            ) : null}
            {openTasks.length > 0 ? (
              <CollapsibleSection nested storageKey="home-tasks-open" title={<span className="meta">פתוחות</span>} action={<span className="meta">{openTasks.length}</span>}>
                <ul className="stack">
                  {openTasks.map((task) => (
                    <TaskLine key={task.id} task={task} />
                  ))}
                </ul>
              </CollapsibleSection>
            ) : null}
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
                      endActions={[
                        { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => startEdit(item, list.id) },
                        { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => removeItem(item), tone: "danger" },
                      ]}
                    >
                      <IconButton
                        className="icon-btn-done"
                        label={`סימון ${item.name} כנקנה`}
                        onClick={() => toggleBought(item)}
                      >
                        <Check aria-hidden="true" />
                      </IconButton>
                      <div className="row-open shop-pair">
                        <span className="shop-amount">{formatAmount(item) || "–"}</span>
                        <ItemLabel value={item.name} />
                      </div>
                      <RowMenu>
                        <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => startEdit(item, list.id)}>עריכה</MenuItem>
                        <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => removeItem(item)}>מחיקה</MenuItem>
                      </RowMenu>
                    </SwipeRow>
                  ))}
                </ul>
              </CollapsibleSection>
            ))}
          </CollapsibleSection>
        </div>
      </div>
      <Sheet
        open={Boolean(peek)}
        title={peek?.kind === "class" ? peek.row.name : peek?.row.title ?? ""}
        onClose={() => setPeek(null)}
      >
        {peek?.kind === "class" ? (
          <div className="stack">
            <p>{personName(peek.row.person_id)}</p>
            <p className="meta">
              {classDays(peek.row).map((day) => WEEKDAYS[day]).join(", ")}
              {" · "}
              {peek.row.starts_at.slice(0, 5)}
              {peek.row.ends_at ? `–${peek.row.ends_at.slice(0, 5)}` : ""}
            </p>
            {peek.row.place ? <PlaceNav place={peek.row.place} /> : null}
            <Link className="btn btn-quiet" href="/classes" onClick={() => setPeek(null)}>לכל החוגים</Link>
          </div>
        ) : null}
        {peek?.kind === "event" ? (
          <div className="stack">
            <p className="meta">
              {eventKindLabel(peek.row.kind, kinds)}
              {" · "}
              {formatDate(peek.row.event_date)}
              {peek.row.event_time ? ` · ${peek.row.event_time.slice(0, 5)}` : ""}
            </p>
            {peek.row.person_id ? <PersonLink id={peek.row.person_id} name={personName(peek.row.person_id)} /> : null}
            {peek.row.place ? <PlaceNav place={peek.row.place} /> : null}
            {peek.row.notes ? <p>{peek.row.notes}</p> : null}
            {peek.row.remind_day_before ? <p className="meta">תזכורת יום לפני</p> : null}
            <Link className="btn btn-quiet" href="/events" onClick={() => setPeek(null)}>לכל האירועים</Link>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={Boolean(editing)} title="עריכת פריט" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="stack" onSubmit={saveEdit}>
            <label>
              שם
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required autoFocus />
            </label>
            <label>
              כמות
              <input inputMode="decimal" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
            </label>
            <label>
              קטגוריה
              <select value={editing.listId} onChange={(e) => setEditing({ ...editing, listId: e.target.value })}>
                {(lists ?? []).map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={editing.oneOff} onChange={(e) => setEditing({ ...editing, oneOff: e.target.checked })} />
              חד-פעמי
            </label>
            <button className="btn btn-primary" type="submit">שמירת שינוי</button>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}
