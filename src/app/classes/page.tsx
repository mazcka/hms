"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { Alert, Empty, PersonLink } from "@/components/ui";
import { classDays, WeekdayPicker } from "@/components/weekday-picker";
import { RELATIONS, WEEKDAYS } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
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

export default function ClassesPage() {
  const gate = useHousehold();
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [personName, setPersonName] = useState("");
  const [relation, setRelation] = useState<Person["relation"]>("daughter");
  const [form, setForm] = useState({ person_id: "", name: "", weekdays: [0] as number[], starts_at: "", ends_at: "", place: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!gate) return;
    const [p, c] = await Promise.all([
      gate.supabase.from("hms_people").select("id, name, relation").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_classes").select("id, person_id, name, weekday, weekdays, starts_at, ends_at, place, active").eq("household_id", gate.member.household_id).order("starts_at"),
    ]);
    if (p.error || c.error) setError(p.error?.message || c.error?.message || "");
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

  async function addPerson(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!gate) return;
    if (!personName.trim()) {
      setError("חסר שם.");
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_people").insert({
      household_id: gate.member.household_id,
      name: personName.trim(),
      relation,
    });
    if (writeError) setError(writeError.message);
    else {
      setPersonName("");
      await load();
    }
  }

  async function addClass(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.person_id || !form.name.trim() || !form.starts_at || form.weekdays.length === 0) {
      setError("צריך אדם, שם חוג, יום ושעת התחלה.");
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
    if (writeError) setError(writeError.message);
    else {
      setEditingId(null);
      setForm({ ...form, name: "", starts_at: "", ends_at: "", place: "" });
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
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ person_id: "", name: "", weekdays: [0], starts_at: "", ends_at: "", place: "" });
  }

  async function removePerson(id: string) {
    if (!gate || !window.confirm("למחוק את האדם?")) return;
    const { error: writeError } = await gate.supabase.from("hms_people").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else {
      if (form.person_id === id) setForm({ ...form, person_id: "" });
      await load();
    }
  }

  async function toggle(row: ClassRow) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_classes").update({ active: !row.active }).eq("id", row.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function remove(id: string) {
    if (!gate) return;
    if (!window.confirm("למחוק את החוג?")) return;
    const { error: writeError } = await gate.supabase.from("hms_classes").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  return (
    <>
      <h1>חוגים</h1>
      <Alert>{error}</Alert>
      <details className="add card">
        <summary>אנשים</summary>
        <div className="stack">
          <ul className="stack">
            {people.map((person) => (
              <li key={person.id} className="spread">
                <span>{person.name} · {RELATIONS[person.relation]}</span>
                <button className="btn btn-danger" type="button" onClick={() => removePerson(person.id)}>מחיקה</button>
              </li>
            ))}
          </ul>
          <div className="row">
            <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="שם" aria-label="שם" />
            <select value={relation} aria-label="קשר" onChange={(e) => setRelation(e.target.value as Person["relation"])}>
              {Object.entries(RELATIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button className="btn btn-quiet" type="button" onClick={(event) => addPerson(event)}>הוספה</button>
          </div>
        </div>
      </details>
      <details className="add card" open={formOpen} onToggle={(event) => setFormOpen(event.currentTarget.open)}>
      <summary>{editingId ? "עריכת חוג" : "חוג"}</summary>
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
      </details>
      {!rows ? <p>טוען…</p> : null}
      {rows && rows.length === 0 ? <Empty title="אין חוגים" /> : null}
      {WEEKDAYS.map((day, index) => {
        const dayRows = (rows ?? []).filter((row) => classDays(row).includes(index));
        if (!dayRows.length) return null;
        return (
          <section className="card" key={day}>
            <h2>{day}</h2>
            <ul className="stack">
              {dayRows.map((row) => (
                <li key={row.id} className="spread">
                  <span>
                    {row.starts_at.slice(0, 5)}
                    {row.ends_at ? `–${row.ends_at.slice(0, 5)}` : ""} · {row.name}
                    {row.place ? ` · ${row.place}` : ""}
                    {row.active ? "" : " · מושהה"}{" "}
                    <PersonLink id={row.person_id} name={people.find((p) => p.id === row.person_id)?.name ?? ""} />
                  </span>
                  <span className="task-actions">
                    <button className="icon-btn" type="button" aria-label="עריכה" onClick={() => startEdit(row)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 20h4l10-10-4-4L4 16z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="m13 7 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </button>
                    <button className="icon-btn" type="button" aria-label={row.active ? "השהיה" : "הפעלה"} onClick={() => toggle(row)}>
                      {row.active ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 6v12l10-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <button className="icon-btn icon-btn-danger" type="button" aria-label="מחיקה" onClick={() => remove(row.id)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 8h14M9 8V6h6v2M8 8l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
