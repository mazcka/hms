"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { TaskLine } from "@/components/task-line";
import { Alert, Empty } from "@/components/ui";
import { TASK_FIELDS, TASKS_CHANGED, arrangeTasks, notifyTasksChanged, type Task } from "@/lib/task";

export default function TasksPage() {
  const gate = useHousehold();
  const [rows, setRows] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
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

  if (!gate) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!title.trim()) {
      setError("חסרה כותרת.");
      return;
    }
    setPending(true);
    setError("");
    const { error: writeError } = await gate.supabase.from("hms_tasks").insert({
      title: title.trim(),
      status: "open",
      assignee_id: gate.member.id,
      household_id: gate.member.household_id,
      created_by: gate.member.id,
    });
    setPending(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setTitle("");
    notifyTasksChanged();
  }

  return (
    <>
      <h1>משימות</h1>
      <Alert>{error}</Alert>
      <form className="row add" onSubmit={save}>
        <input
          value={title}
          aria-label="משימה חדשה"
          placeholder="משימה חדשה"
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "שומר…" : "הוספה"}</button>
      </form>
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
