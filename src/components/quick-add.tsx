"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { IconButton } from "@/components/menu";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { WeekdayPicker } from "@/components/weekday-picker";
import { EVENT_KINDS } from "@/lib/labels";
import { parseShoppingText } from "@/lib/shop-list";
import { notifyRefresh, notifyTasksChanged } from "@/lib/task";

type Kind = "task" | "shop" | "class" | "event" | "wish";
type Person = { id: string; name: string };
type List = { id: string; name: string };

const KINDS: { id: Kind; label: string }[] = [
  { id: "task", label: "משימה" },
  { id: "shop", label: "קניות" },
  { id: "class", label: "חוג" },
  { id: "event", label: "אירוע" },
  { id: "wish", label: "משאלה" },
];

export function QuickAdd() {
  const gate = useHousehold();
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
  const [eventKind, setEventKind] = useState<keyof typeof EVENT_KINDS>("other");
  const [people, setPeople] = useState<Person[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setMenu(false);
    setKind(null);
    setTitle("");
    setExtra("");
    setEndsAt("");
    setPlace("");
    setError("");
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
    if (kind === "shop") {
      gate.supabase.from("hms_shop_lists").select("id, name").eq("household_id", hid).order("name").then(({ data }) => {
        const rows = (data ?? []) as List[];
        setLists(rows);
        setListId(rows[0]?.id ?? "");
      });
    }
  }, [gate, kind]);

  if (!gate) return null;
  const current = gate;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!kind || !title.trim()) {
      setError("חסר שם.");
      return;
    }
    setPending(true);
    setError("");
    const hid = current.member.household_id;
    let message = "";
    if (kind === "task") {
      const { error: writeError } = await current.supabase.from("hms_tasks").insert({
        household_id: hid,
        title: title.trim(),
        assignee_id: current.member.id,
        created_by: current.member.id,
      });
      message = writeError?.message ?? "";
      if (!message) notifyTasksChanged();
    }
    if (kind === "shop") {
      const names = parseShoppingText(title);
      if (names.length === 0) message = "חסרים פריטים.";
      let target = listId;
      if (!message && !target) {
        const created = await current.supabase.from("hms_shop_lists").insert({ household_id: hid, name: "קניות" }).select("id").single();
        message = created.error?.message ?? "";
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
        message = writeError?.message ?? "";
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
        message = writeError?.message ?? "";
      }
      if (!message) notifyRefresh();
    }
    if (kind === "wish") {
      const { error: writeError } = await current.supabase.from("hms_wishes").insert({
        household_id: hid,
        title: title.trim(),
        created_by: current.member.id,
      });
      message = writeError?.message ?? "";
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
          created_by: current.member.id,
        });
        message = writeError?.message ?? "";
      }
      if (!message) notifyRefresh();
    }
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    close();
  }

  const label = KINDS.find((item) => item.id === kind)?.label ?? "";

  return (
    <>
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
            קול
          </button>
          {KINDS.map((item) => (
            <button
              key={item.id}
              className="quick-choice"
              type="button"
              role="menuitem"
              onClick={() => {
                setKind(item.id);
                setMenu(false);
                setTitle("");
                setExtra("");
                setEndsAt("");
                setPlace("");
                setError("");
              }}
            >
              {item.label}
            </button>
          ))}
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
              <p className="eyebrow">{label}</p>
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
            {error ? <p className="alert" role="alert">{error}</p> : null}
            {kind === "shop" && lists.length > 0 ? (
              <label>
                רשימה
                <select value={listId} onChange={(e) => setListId(e.target.value)}>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
              </label>
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
                  <select value={eventKind} onChange={(e) => setEventKind(e.target.value as keyof typeof EVENT_KINDS)}>
                    {Object.entries(EVENT_KINDS).map(([value, name]) => (
                      <option key={value} value={value}>{name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  תאריך
                  <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} required />
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
