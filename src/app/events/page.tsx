"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { Alert, Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { EVENT_KINDS } from "@/lib/labels";

type Person = { id: string; name: string };
type EventRow = {
  id: string;
  title: string;
  kind: keyof typeof EVENT_KINDS;
  event_date: string;
  event_time: string | null;
  person_id: string | null;
  place: string | null;
  notes: string | null;
  remind_day_before: boolean;
};

const blank = { title: "", kind: "birthday" as keyof typeof EVENT_KINDS, event_date: "", event_time: "", person_id: "", place: "", notes: "", remind_day_before: true };

export default function EventsPage() {
  const gate = useHousehold();
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [form, setForm] = useState(blank);
  const [composer, setComposer] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (!gate) return;
    const [p, e] = await Promise.all([
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_events").select("id, title, kind, event_date, event_time, person_id, place, notes, remind_day_before").eq("household_id", gate.member.household_id).order("event_date"),
    ]);
    if (p.error || e.error) setError(p.error?.message || e.error?.message || "");
    setPeople((p.data ?? []) as Person[]);
    setRows((e.data ?? []) as EventRow[]);
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.title.trim() || !form.event_date) {
      setError("לאירוע, ובמיוחד ליום הולדת, חובה כותרת ותאריך.");
      return;
    }
    setError("");
    const { error: writeError } = await gate.supabase.from("hms_events").insert({
      household_id: gate.member.household_id,
      title: form.title.trim(),
      kind: form.kind,
      event_date: form.event_date,
      event_time: form.event_time || null,
      person_id: form.person_id || null,
      place: form.place.trim() || null,
      notes: form.notes.trim() || null,
      remind_day_before: form.remind_day_before,
      created_by: gate.member.id,
    });
    if (writeError) setError(writeError.message);
    else {
      setForm(blank);
      setComposer(false);
      await load();
    }
  }

  async function remove(id: string) {
    if (!gate) return;
    if (!window.confirm("למחוק את האירוע?")) return;
    const { error: writeError } = await gate.supabase.from("hms_events").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function enableReminders() {
    if (typeof Notification === "undefined") {
      setNotice("הדפדפן לא תומך בהתראות.");
      return;
    }
    const result = await Notification.requestPermission();
    setNotice(result === "granted" ? "תזכורת ליום לפני תופיע כשהאפליקציה נפתחת." : "ההרשאה לא ניתנה.");
  }

  return (
    <>
      <PageHead title="אירועים" action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>אירוע חדש</button>} />
      <Alert>{error}</Alert>
      {notice ? <p className="note">{notice}</p> : null}
      <Sheet open={composer} title="אירוע חדש" onClose={() => setComposer(false)}>
      <form className="stack" onSubmit={save}>
        <label>
          כותרת
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          תאריך
          <input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        </label>
        <details>
          <summary>עוד פרטים</summary>
          <div className="stack">
            <label>
              סוג
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventRow["kind"] })}>
                {Object.entries(EVENT_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              שעה
              <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
            </label>
            <label>
              קשור ל
              <select value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
                <option value="">בלי שיוך</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label>
              מקום
              <PlaceField value={form.place} onChange={(place) => setForm({ ...form, place })} />
            </label>
            <label>
              הערות
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={form.remind_day_before} onChange={(e) => setForm({ ...form, remind_day_before: e.target.checked })} />
              תזכורת יום לפני
            </label>
            <button className="btn btn-quiet" type="button" onClick={enableReminders}>תזכורת</button>
          </div>
        </details>
        <button className="btn btn-primary" type="submit">שמירה</button>
      </form>
      </Sheet>
      {!rows ? <Skeleton rows={3} /> : null}
      {rows && rows.length === 0 ? <Empty title="אין אירועים" action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>אירוע חדש</button>} /> : null}
      {rows && rows.length > 0 ? (
        <section className="card">
          <ul className="stack">
            {rows.map((row) => (
              <li key={row.id} className="row-line">
                <div className="row-open">
                  <span>{row.title}</span>
                  <span className="meta">
                    {EVENT_KINDS[row.kind]} {row.event_date}
                    {row.event_time ? ` ${row.event_time.slice(0, 5)}` : ""}
                    {row.person_id ? <PersonLink id={row.person_id} name={people.find((p) => p.id === row.person_id)?.name ?? ""} /> : null}
                  </span>
                </div>
                <RowMenu>
                  <MenuItem danger onSelect={() => remove(row.id)}>מחיקה</MenuItem>
                </RowMenu>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
