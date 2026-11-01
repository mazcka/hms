"use client";

import { CalendarDays, CheckSquare, Gift, Mic, Plus, ShoppingBag, Sparkles, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { IconButton } from "@/components/menu";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { WeekdayPicker } from "@/components/weekday-picker";
import { eventKindOptions } from "@/lib/labels";
import { parseShoppingText } from "@/lib/shop-list";
import { notifyRefresh, notifyTasksChanged } from "@/lib/task";

type Kind = "task" | "shop" | "class" | "event" | "wish";
type Person = { id: string; name: string };
type EventKind = { id: string; label: string };
type List = { id: string; name: string };

const KINDS: { id: Kind; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "task", label: "משימה", hint: "משהו שצריך לעשות", icon: CheckSquare },
  { id: "shop", label: "קניות", hint: "פריטים לרשימה", icon: ShoppingBag },
  { id: "class", label: "חוג", hint: "שעה קבועה בשבוע", icon: CalendarDays },
  { id: "event", label: "אירוע", hint: "תאריך ביומן הבית", icon: Sparkles },
  { id: "wish", label: "משאלה", hint: "משהו שרוצים", icon: Gift },
];

export function QuickAdd() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [title, setTitle] = useState("");
  const [extra, setExtra] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0]);
  const [endsAt, setEndsAt] = useState("");
  const [place, setPlace] = useState("");
  const [personId, setPersonId] = useState("");
  const [listId, setListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [eventKind, setEventKind] = useState("other");
  const [eventKinds, setEventKinds] = useState<EventKind[]>([]);
  const [eventTime, setEventTime] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [pending, setPending] = useState(false);

  function close() {
    setMenu(false);
    setKind(null);
    setTitle("");
    setExtra("");
    setEndsAt("");
    setEventTime("");
    setPlace("");
    setNewListName("");
    setPending(false);
  }

  useEffect(() => {
    if (!menu && !kind) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, kind]);

  useEffect(() => {
    if (!gate || !kind) return;
    const hid = gate.member.household_id;
    if (kind === "class" || kind === "event") {
      gate.supabase.from("hms_people").select("id, name").eq("household_id", hid).order("name").then(({ data }) => {
        const rows = (data ?? []) as Person[];
        setPeople(rows);
        setPersonId(rows[0]?.id ?? "");
      });
    }
    if (kind === "event") {
      gate.supabase.from("hms_event_kinds").select("id, label").eq("household_id", hid).order("label").then(({ data }) => {
        setEventKinds((data ?? []) as EventKind[]);
      });
    }
    if (kind === "shop") {
      gate.supabase.from("hms_shop_lists").select("id, name, sort_order").eq("household_id", hid).order("sort_order").then(({ data }) => {
        const rows = (data ?? []) as List[];
        setLists(rows);
        setListId(rows[0]?.id ?? "__new__");
      });
    }
  }, [gate, kind]);

  if (!gate) return null;
  const current = gate;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!kind || !title.trim()) {
      showNotice({ tone: "error", text: "חסר שם." });
      return;
    }
    setPending(true);
    const hid = current.member.household_id;
    const writeFailed = "לא הצלחנו לשמור. נסה שוב.";
    let message = "";
    if (kind === "task") {
      const { error: writeError } = await current.supabase.from("hms_tasks").insert({
        household_id: hid,
        title: title.trim(),
        assignee_id: current.member.id,
        created_by: current.member.id,
      });
      message = writeError ? writeFailed : "";
      if (!message) notifyTasksChanged();
    }
    if (kind === "shop") {
      const names = parseShoppingText(title);
      if (names.length === 0) message = "חסרים פריטים.";
      let target = listId === "__new__" ? "" : listId;
      if (!message && listId === "__new__") {
        const name = newListName.trim();
        if (!name) message = "חסר שם קטגוריה.";
        else {
          const created = await current.supabase.from("hms_shop_lists").insert({ household_id: hid, name }).select("id").single();
          message = created.error ? writeFailed : "";
          target = (created.data as { id: string } | null)?.id ?? "";
        }
      }
      if (!message && !target) {
        const created = await current.supabase.from("hms_shop_lists").insert({ household_id: hid, name: "קניות" }).select("id").single();
        message = created.error ? writeFailed : "";
        target = (created.data as { id: string } | null)?.id ?? "";
      }
      if (!message && target) {
        const { error: writeError } = await current.supabase.from("hms_shop_items").insert(
          names.map((item) => ({
            household_id: hid,
            list_id: target,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          })),
        );
        message = writeError ? writeFailed : "";
      }
      if (!message) notifyRefresh();
    }
    if (kind === "class") {
      if (!personId || !extra || weekdays.length === 0) message = "צריך אדם, יום ושעת התחלה.";
      else {
        const days = [...weekdays].sort((a, b) => a - b);
        const { error: writeError } = await current.supabase.from("hms_classes").insert({
          household_id: hid,
          person_id: personId,
          name: title.trim(),
          weekday: days[0],
          weekdays: days,
          starts_at: extra,
          ends_at: endsAt || null,
          place: place.trim() || null,
        });
        message = writeError ? writeFailed : "";
      }
      if (!message) notifyRefresh();
    }
    if (kind === "wish") {
      const { error: writeError } = await current.supabase.from("hms_wishes").insert({
        household_id: hid,
        title: title.trim(),
        created_by: current.member.id,
      });
      message = writeError ? writeFailed : "";
      if (!message) notifyRefresh();
    }
    if (kind === "event") {
      if (!extra) message = "חסר תאריך.";
      else {
        const { error: writeError } = await current.supabase.from("hms_events").insert({
          household_id: hid,
          title: title.trim(),
          kind: eventKind,
          event_date: extra,
          event_time: eventTime || null,
          created_by: current.member.id,
        });
        message = writeError ? writeFailed : "";
      }
      if (!message) notifyRefresh();
    }
    setPending(false);
    if (message) {
      showNotice({ tone: "error", text: message });
      return;
    }
    showNotice({ tone: "ok", text: `${title.trim()} נוסף.` });
    close();
  }

  const label = KINDS.find((item) => item.id === kind)?.label ?? "";

  return (
    <>
      {menu ? (
        <button className="quick-scrim" type="button" aria-label="סגירת יצירה" onClick={() => setMenu(false)} />
      ) : null}
      {menu ? (
        <div className="quick-menu" role="menu" aria-label="יצירה מהירה">
          <button
            className="quick-choice"
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              router.push("/voice");
            }}
          >
            <span className="quick-choice-icon" aria-hidden="true"><Mic size={18} /></span>
            <span className="quick-choice-copy">
              <strong>קול</strong>
              <span>להוסיף בדיבור</span>
            </span>
          </button>
          {KINDS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="quick-choice"
                type="button"
                role="menuitem"
                onClick={() => {
                  setKind(item.id);
                  setMenu(false);
                  setTitle("");
                  setNewListName("");
                  setExtra("");
                  setEndsAt("");
                  setPlace("");
                }}
              >
                <span className="quick-choice-icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="quick-choice-copy">
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <IconButton
        className="quick-add"
        aria-expanded={menu}
        label={menu ? "סגירת יצירה" : "יצירה מהירה"}
        onClick={() => setMenu((open) => !open)}
      >
        {menu ? <X size={22} aria-hidden="true" /> : <Plus size={22} aria-hidden="true" />}
      </IconButton>
      {kind ? (
        <div className="modal-back" role="presentation" onClick={close}>
          <form className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <header className="modal-head">
              <h2>{label}</h2>
              <IconButton label="סגירה" onClick={close}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </header>
            {kind === "shop" ? (
              <textarea
                className="modal-note"
                value={title}
                aria-label="פריטים"
                placeholder={"חלב\nביצים\n5 פיתות\n8 מלפפונים"}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            ) : (
              <input className="modal-title" value={title} aria-label="שם" placeholder="שם" onChange={(e) => setTitle(e.target.value)} required autoFocus />
            )}
            {kind === "shop" ? (
              <>
                <label>
                  רשימה
                  <select value={listId} onChange={(e) => setListId(e.target.value)}>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                    <option value="__new__">קטגוריה חדשה</option>
                  </select>
                </label>
                {listId === "__new__" ? (
                  <label>
                    שם הקטגוריה
                    <input value={newListName} aria-label="שם הקטגוריה" placeholder="למשל ירקות" onChange={(e) => setNewListName(e.target.value)} autoFocus />
                  </label>
                ) : null}
              </>
            ) : null}
            {kind === "class" ? (
              <div className="modal-grid">
                <label>
                  אדם
                  <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                    {people.length === 0 ? <option value="">אין אנשים</option> : null}
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </label>
                <WeekdayPicker value={weekdays} onChange={setWeekdays} />
                <label>
                  שעה
                  <input type="time" value={extra} onChange={(e) => setExtra(e.target.value)} required />
                </label>
                <label>
                  סיום
                  <input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </label>
                <label>
                  מקום
                  <PlaceField value={place} onChange={setPlace} />
                </label>
              </div>
            ) : null}
            {kind === "event" ? (
              <div className="modal-grid">
                <label>
                  סוג
                  <select value={eventKind} onChange={(e) => setEventKind(e.target.value)}>
                    {eventKindOptions(eventKinds).map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  תאריך
                  <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} required />
                </label>
                <label>
                  שעה
                  <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                </label>
              </div>
            ) : null}
            <footer className="modal-foot">
              <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "שומר…" : "הוספה"}</button>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}
