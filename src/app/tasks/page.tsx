"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { TaskLine } from "@/components/task-line";
import { Alert, Empty } from "@/components/ui";
import { TASK_STATUS, WEEKDAYS } from "@/lib/labels";
import { TASK_FIELDS, TASKS_CHANGED, arrangeTasks, notifyTasksChanged, type Task } from "@/lib/task";

const empty = { title: "", details: "", status: "open" as Task["status"], due_date: "", due_time: "", weekday: "", assignee_id: "" };

export default function TasksPage() {
  const gate = useHousehold();
  const [rows, setRows] = useState<Task[] | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!gate) return;
    let active = true;
    async function load() {
      const { data, error: queryError } = await gate!.supabase
        .from("hms_tasks")
        .select(TASK_FIELDS)
        .eq("household_id", gate!.member.household_id);
      if (!active) return;
      if (queryError) setError(queryError.message);
      setRows(arrangeTasks((data ?? []) as Task[]));
    }
    load();
    window.addEventListener(TASKS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(TASKS_CHANGED, load);
    };
  }, [gate]);

  useEffect(() => {
    if (!gate) return;
    setForm((current) => (current.assignee_id ? current : { ...current, assignee_id: gate.member.id }));
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
    const { error: writeError } = await gate.supabase.from("hms_tasks").insert({
      title: form.title.trim(),
      details: form.details.trim() || null,
      status: form.status,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      weekday: form.weekday === "" ? null : Number(form.weekday),
      assignee_id: form.assignee_id || gate.member.id,
      household_id: gate.member.household_id,
      created_by: gate.member.id,
    });
    setPending(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setForm({ ...empty, assignee_id: gate.member.id });
    notifyTasksChanged();
  }

  return (
    <>
      <h1>משימות</h1>
      <Alert>{error}</Alert>
      <details className="add card">
        <summary>משימה</summary>
        <form className="stack" onSubmit={save}>
          <h2>משימה חדשה</h2>
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
          <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "שומר…" : "שמירה"}</button>
        </form>
      </details>
      {!rows ? <p>טוען…</p> : null}
      {rows && rows.length === 0 ? <Empty title="אין משימות" /> : null}
      {rows && rows.length > 0 ? (
        <section className="card tone tone-tasks">
          <ul className="stack">
            {rows.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
