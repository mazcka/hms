"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";
import { TASK_STATUS, WEEKDAYS } from "@/lib/labels";

type Task = {
  id: string;
  title: string;
  details: string | null;
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  due_time: string | null;
  weekday: number | null;
  assignee_id: string | null;
};

const empty = { title: "", details: "", status: "open" as Task["status"], due_date: "", due_time: "", weekday: "", assignee_id: "" };

export default function TasksPage() {
  const gate = useHousehold();
  const [rows, setRows] = useState<Task[] | null>(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    if (!gate) return;
    const { data, error: queryError } = await gate.supabase
      .from("hms_tasks")
      .select("id, title, details, status, due_date, due_time, weekday, assignee_id")
      .eq("household_id", gate.member.household_id)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    setRows((data ?? []) as Task[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.title.trim()) {
      setError("חסרה כותרת.");
      return;
    }
    setPending(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      details: form.details.trim() || null,
      status: form.status,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      weekday: form.weekday === "" ? null : Number(form.weekday),
      assignee_id: form.assignee_id || null,
      updated_at: new Date().toISOString(),
    };
    const query = editing
      ? gate.supabase.from("hms_tasks").update(payload).eq("id", editing)
      : gate.supabase.from("hms_tasks").insert({
          ...payload,
          household_id: gate.member.household_id,
          created_by: gate.member.id,
        });
    const { error: writeError } = await query;
    setPending(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setForm(empty);
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!gate || !window.confirm("למחוק את המשימה?")) return;
    const { error: writeError } = await gate.supabase.from("hms_tasks").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  return (
    <>
      <h1>משימות בית</h1>
      <p className="lede">עבודה בבית, בלי פריטי קניות.</p>
      <Alert>{error}</Alert>
      <form className="card stack" onSubmit={save}>
        <h2>{editing ? "עריכת משימה" : "משימה חדשה"}</h2>
        <label>
          כותרת
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          פירוט
          <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </label>
        <label>
          סטטוס
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}>
            {Object.entries(TASK_STATUS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          תאריך יעד
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </label>
        <label>
          שעה
          <input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
        </label>
        <label>
          יום חוזר
          <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
            <option value="">בלי חזרה</option>
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>{day}</option>
            ))}
          </select>
        </label>
        <label>
          אחראי
          <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
            <option value="">לא שויך</option>
            {gate.members.map((member) => (
              <option key={member.id} value={member.id}>{member.display_name}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "שומר…" : "שמירה"}</button>
          {editing ? (
            <button className="btn btn-quiet" type="button" onClick={() => { setEditing(null); setForm(empty); }}>ביטול עריכה</button>
          ) : null}
        </div>
      </form>
      {!rows ? <p>טוען…</p> : null}
      {rows && rows.length === 0 ? <Empty title="עדיין אין משימות בית" hint="הוסיפו כותרת בטופס למעלה." /> : null}
      {rows?.map((task) => (
        <article className="card" key={task.id}>
          <div className="spread">
            <h2>{task.title}</h2>
            <span className="meta">{TASK_STATUS[task.status]}</span>
          </div>
          {task.details ? <p>{task.details}</p> : null}
          <p className="meta">
            {task.due_date ? `יעד ${task.due_date}` : "בלי תאריך"}
            {task.weekday !== null ? ` · חוזר ב${WEEKDAYS[task.weekday]}` : ""}
            {task.assignee_id ? ` · ${gate.members.find((m) => m.id === task.assignee_id)?.display_name ?? ""}` : ""}
          </p>
          <div className="row">
            <button
              className="btn btn-quiet"
              type="button"
              onClick={() => {
                setEditing(task.id);
                setForm({
                  title: task.title,
                  details: task.details ?? "",
                  status: task.status,
                  due_date: task.due_date ?? "",
                  due_time: task.due_time?.slice(0, 5) ?? "",
                  weekday: task.weekday === null ? "" : String(task.weekday),
                  assignee_id: task.assignee_id ?? "",
                });
              }}
            >
              עריכה
            </button>
            <button className="btn btn-danger" type="button" onClick={() => remove(task.id)}>מחיקה</button>
          </div>
        </article>
      ))}
    </>
  );
}
