"use client";

import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PlaceField } from "@/components/place-field";
import { MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Alert, Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
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
      setFormOpen(false);
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
      <PageHead
        title="חוגים"
        action={<button className="btn btn-primary" type="button" onClick={() => { setEditingId(null); setFormOpen(true); }}>חוג חדש</button>}
      />
      <Alert>{error}</Alert>
      <details className="add card">
        <summary>אנשים</summary>
        <div className="stack">
          <ul className="stack">
            {people.map((person) => (
                <SwipeRow
                  key={person.id}
                  endActions={[{
                    label: "מחיקה",
                    icon: <Trash2 aria-hidden="true" />,
                    onSelect: () => removePerson(person.id),
                    tone: "danger",
                  }]}
                >
                  <div className="row-open">
                    <span>{person.name}</span>
                    <span className="meta">{RELATIONS[person.relation]}</span>
                  </div>
                  <RowMenu label={`פעולות ${person.name}`}>
                    <MenuItem danger onSelect={() => removePerson(person.id)}>מחיקה</MenuItem>
                  </RowMenu>
                </SwipeRow>
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
      {WEEKDAYS.map((day, index) => {
        const dayRows = (rows ?? []).filter((row) => classDays(row).includes(index));
        if (!dayRows.length) return null;
        return (
          <CollapsibleSection storageKey={`classes-day-${index}`} title={<h2>{day}</h2>} key={day}>
            <ul className="stack">
              {dayRows.map((row) => (
                <SwipeRow
                  key={row.id}
                  startActions={[{
                    label: row.active ? "השהיה" : "הפעלה",
                    icon: row.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />,
                    onSelect: () => toggle(row),
                    tone: row.active ? "warning" : "primary",
                  }]}
                  endActions={[
                    { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => startEdit(row) },
                    { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => remove(row.id), tone: "danger" },
                  ]}
                >
                  <span>
                    {row.starts_at.slice(0, 5)}
                    {row.ends_at ? `–${row.ends_at.slice(0, 5)}` : ""} · {row.name}
                    {row.place ? ` · ${row.place}` : ""}
                    {row.active ? "" : " · מושהה"}{" "}
                    <PersonLink id={row.person_id} name={people.find((p) => p.id === row.person_id)?.name ?? ""} />
                  </span>
                  <RowMenu>
                    <MenuItem onSelect={() => startEdit(row)}>עריכה</MenuItem>
                    <MenuItem onSelect={() => toggle(row)}>{row.active ? "השהיה" : "הפעלה"}</MenuItem>
                    <MenuItem danger onSelect={() => remove(row.id)}>מחיקה</MenuItem>
                  </RowMenu>
                </SwipeRow>
              ))}
            </ul>
          </CollapsibleSection>
        );
      })}
    </>
  );
}
