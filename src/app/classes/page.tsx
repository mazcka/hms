"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty, PersonLink } from "@/components/ui";
import { RELATIONS, WEEKDAYS } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
type ClassRow = {
  id: string;
  person_id: string;
  name: string;
  weekday: number;
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
  const [form, setForm] = useState({ person_id: "", name: "", weekday: "0", starts_at: "", ends_at: "", place: "" });
  const [error, setError] = useState("");

  async function load() {
    if (!gate) return;
    const [p, c] = await Promise.all([
      gate.supabase.from("hms_people").select("id, name, relation").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_classes").select("id, person_id, name, weekday, starts_at, ends_at, place, active").eq("household_id", gate.member.household_id).order("weekday"),
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

  async function addPerson(event: FormEvent) {
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
    if (!form.person_id || !form.name.trim() || !form.starts_at) {
      setError("צריך אדם, שם חוג ושעת התחלה.");
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_classes").insert({
      household_id: gate.member.household_id,
      person_id: form.person_id,
      name: form.name.trim(),
      weekday: Number(form.weekday),
      starts_at: form.starts_at,
      ends_at: form.ends_at || null,
      place: form.place.trim() || null,
    });
    if (writeError) setError(writeError.message);
    else {
      setForm({ ...form, name: "", starts_at: "", ends_at: "", place: "" });
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
      <summary>אדם או חוג</summary>
      <form className="stack" onSubmit={addPerson}>
        <h2>אדם בלי חשבון</h2>
        <label>
          שם
          <input value={personName} onChange={(e) => setPersonName(e.target.value)} />
        </label>
        <label>
          קשר
          <select value={relation} onChange={(e) => setRelation(e.target.value as Person["relation"])}>
            {Object.entries(RELATIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-quiet" type="submit">הוספת אדם</button>
      </form>
      <form className="stack" onSubmit={addClass}>
        <h2>חוג</h2>
        <label>
          עבור
          <select value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
            <option value="">בחירה</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label>
          שם החוג
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          יום
          <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>{day}</option>
            ))}
          </select>
        </label>
        <label>
          התחלה
          <input type="time" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </label>
        <label>
          סיום
          <input type="time" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </label>
        <label>
          מקום
          <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
        </label>
        <button className="btn btn-primary" type="submit">שמירת חוג</button>
      </form>
      </details>
      {!rows ? <p>טוען…</p> : null}
      {rows && rows.length === 0 ? <Empty title="אין חוגים" /> : null}
      {WEEKDAYS.map((day, index) => {
        const dayRows = (rows ?? []).filter((row) => row.weekday === index);
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
                  <span className="row">
                    <button className="btn btn-quiet" type="button" onClick={() => toggle(row)}>{row.active ? "השהיה" : "הפעלה"}</button>
                    <button className="btn btn-danger" type="button" onClick={() => remove(row.id)}>מחיקה</button>
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
