"use client";

import Link from "next/link";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { MenuItem, RowMenu } from "@/components/menu";
import { SectionTabs } from "@/components/section-tabs";
import { Sheet } from "@/components/sheet";
import { Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { classDays, WeekdayPicker } from "@/components/weekday-picker";
import { WEEKDAYS } from "@/lib/labels";
import { notifyRefresh } from "@/lib/task";

type Person = { id: string; name: string };
type ClassRow = {
  id: string;
  person_id: string;
  name: string;
  weekday: number;
  weekdays: number[];
  starts_at: string;
  ends_at: string | null;
  place: string | null;
  active: boolean;
};

function byStart(a: ClassRow, b: ClassRow) {
  return a.starts_at.localeCompare(b.starts_at);
}

export default function ClassesPage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [form, setForm] = useState({ person_id: "", name: "", weekdays: [0] as number[], starts_at: "", ends_at: "", place: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    if (!gate) return;
    const [p, c] = await Promise.all([
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_classes").select("id, person_id, name, weekday, weekdays, starts_at, ends_at, place, active").eq("household_id", gate.member.household_id).order("starts_at"),
    ]);
    if (p.error || c.error) showNotice({ tone: "error", text: "לא הצלחנו לטעון את החוגים. נסה שוב." });
    setPeople((p.data ?? []) as Person[]);
    setRows((c.data ?? []) as ClassRow[]);
  }

  useEffect(() => {
    load();
    function onRefresh() {
      load();
    }
    window.addEventListener("hms-refresh", onRefresh);
    return () => window.removeEventListener("hms-refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return null;

  async function addClass(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.person_id || !form.name.trim() || !form.starts_at || form.weekdays.length === 0) {
      showNotice({ tone: "error", text: "צריך אדם, שם חוג, יום ושעת התחלה." });
      return;
    }
    const weekdays = [...form.weekdays].sort((a, b) => a - b);
    const payload = {
      person_id: form.person_id,
      name: form.name.trim(),
      weekday: weekdays[0],
      weekdays,
      starts_at: form.starts_at,
      ends_at: form.ends_at || null,
      place: form.place.trim() || null,
    };
    const write = editingId
      ? gate.supabase.from("hms_classes").update(payload).eq("id", editingId)
      : gate.supabase.from("hms_classes").insert({ ...payload, household_id: gate.member.household_id });
    const { error: writeError } = await write;
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור את החוג. נסה שוב." });
    else {
      showNotice({ tone: "ok", text: editingId ? `${payload.name} עודכן.` : `${payload.name} נוסף.` });
      setEditingId(null);
      setFormOpen(false);
      setForm({ ...form, name: "", starts_at: "", ends_at: "", place: "" });
      notifyRefresh();
      await load();
    }
  }

  function startEdit(row: ClassRow) {
    const days = classDays(row);
    setForm({
      person_id: row.person_id,
      name: row.name,
      weekdays: days,
      starts_at: row.starts_at.slice(0, 5),
      ends_at: row.ends_at ? row.ends_at.slice(0, 5) : "",
      place: row.place ?? "",
    });
    setEditingId(row.id);
    setFormOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ person_id: "", name: "", weekdays: [0], starts_at: "", ends_at: "", place: "" });
  }

  async function toggle(row: ClassRow) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_classes").update({ active: !row.active }).eq("id", row.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לעדכן את החוג. נסה שוב." });
    else {
      showNotice({
        tone: "ok",
        text: row.active ? `${row.name} הושהה.` : `${row.name} חזר לפעיל.`,
        undo: () => toggle({ ...row, active: !row.active }),
      });
      notifyRefresh();
      await load();
    }
  }

  async function remove(id: string) {
    if (!gate) return;
    const name = rows?.find((row) => row.id === id)?.name ?? "החוג";
    if (!window.confirm(`למחוק את "${name}"?`)) return;
    const { error: writeError } = await gate.supabase.from("hms_classes").delete().eq("id", id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק את החוג. נסה שוב." });
    else {
      showNotice({ tone: "ok", text: `${name} נמחק.` });
      notifyRefresh();
      await load();
    }
  }

  const todayIndex = new Date().getDay();
  const todayRows = (rows ?? []).filter((row) => classDays(row).includes(todayIndex) && row.active);
  const laterDay = Array.from({ length: 6 }, (_, offset) => (todayIndex + offset + 1) % 7).find((index) =>
    (rows ?? []).some((row) => row.active && classDays(row).includes(index)),
  );
  const lede = !rows
    ? "מארגנים את החוגים…"
    : rows.length === 0
      ? "אין חוגים עדיין"
      : todayRows.length > 0
        ? todayRows.length === 1
          ? `היום: ${todayRows[0].name}.`
          : `${todayRows.length} חוגים היום`
        : laterDay !== undefined
          ? `הבא: ${WEEKDAYS[laterDay]}.`
          : "אין חוגים פעילים השבוע";

  return (
    <>
      <PageHead
        title="חוגים"
        lede={lede}
        action={<button className="btn btn-primary" type="button" onClick={() => { setEditingId(null); setFormOpen(true); }}>חוג חדש</button>}
      />
      <SectionTabs />
      {people.length === 0 ? <p className="note">כדי לשייך חוג צריך קודם <Link href="/settings">להוסיף אדם בניהול</Link>.</p> : null}
      <Sheet open={formOpen} title={editingId ? "עריכת חוג" : "חוג חדש"} onClose={() => { setFormOpen(false); setEditingId(null); }}>
      <form className="stack" onSubmit={addClass}>
        <label>
          שם החוג
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          עבור
          <select value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })} required>
            <option value="">בחירה</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <WeekdayPicker value={form.weekdays} onChange={(weekdays) => setForm({ ...form, weekdays })} />
        <label>
          התחלה
          <input type="time" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
        </label>
        <details>
          <summary>עוד פרטים</summary>
          <div className="stack">
            <label>
              סיום
              <input type="time" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </label>
            <label>
              מקום
              <PlaceField value={form.place} onChange={(place) => setForm({ ...form, place })} />
            </label>
          </div>
        </details>
        <div className="row">
          <button className="btn btn-primary" type="submit">{editingId ? "שמירת שינוי" : "שמירת חוג"}</button>
          {editingId ? <button className="btn btn-quiet" type="button" onClick={cancelEdit}>ביטול</button> : null}
        </div>
      </form>
      </Sheet>
      {!rows ? <Skeleton rows={4} /> : null}
      {rows && rows.length === 0 ? <Empty title="אין חוגים" action={<button className="btn btn-primary" type="button" onClick={() => setFormOpen(true)}>חוג חדש</button>} /> : null}
      {rows && rows.length > 0 ? (
        <div className="week-board">
          {WEEKDAYS.map((day, index) => {
            const dayRows = rows.filter((row) => classDays(row).includes(index)).sort(byStart);
            const empty = dayRows.length === 0;
            return (
              <section
                className="week-day"
                key={day}
                data-today={index === todayIndex ? "true" : undefined}
                data-empty={empty ? "true" : undefined}
              >
                <header className="week-day-head">
                  <h2>{day}</h2>
                  <span className="meta">{index === todayIndex ? (empty ? "היום · פנוי" : "היום") : empty ? "פנוי" : null}</span>
                </header>
                {empty ? null : (
                  <ul className="week-events">
                    {dayRows.map((row) => (
                      <li className="week-event-row" key={row.id}>
                        <button className="week-event" type="button" data-paused={row.active ? undefined : "true"} onClick={() => startEdit(row)}>
                          <span className="week-event-time">
                            {row.starts_at.slice(0, 5)}
                            {row.ends_at ? <><br />{row.ends_at.slice(0, 5)}</> : null}
                          </span>
                          <span className="week-event-body">
                            <strong>{row.name}</strong>
                            <span className="meta">
                              {row.place ?? ""}
                              {row.active ? "" : `${row.place ? " · " : ""}מושהה`}
                            </span>
                          </span>
                        </button>
                        <PersonLink id={row.person_id} name={people.find((p) => p.id === row.person_id)?.name ?? ""} people={people} />
                        <RowMenu>
                          <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => startEdit(row)}>עריכה</MenuItem>
                          <MenuItem icon={row.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} onSelect={() => toggle(row)}>{row.active ? "השהיה" : "הפעלה"}</MenuItem>
                          <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => remove(row.id)}>מחיקה</MenuItem>
                        </RowMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
