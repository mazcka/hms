"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { TaskLine } from "@/components/task-line";
import { Empty, PageHead, Skeleton } from "@/components/ui";
import { TASK_FIELDS, TASKS_CHANGED, arrangeTasks, notifyTasksChanged, type Task } from "@/lib/task";

function TaskGroup({
  storageKey,
  title,
  count,
  tasks,
}: {
  storageKey: string;
  title: string;
  count: number;
  tasks: Task[];
}) {
  if (tasks.length === 0) return null;
  return (
    <CollapsibleSection
      storageKey={storageKey}
      title={<h2>{title}</h2>}
      action={<span className="meta">{count}</span>}
      className="panel panel-tasks"
    >
      <ul className="stack">
        {tasks.map((task) => (
          <TaskLine key={task.id} task={task} />
        ))}
      </ul>
    </CollapsibleSection>
  );
}

export default function TasksPage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [rows, setRows] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
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
      if (queryError) showNotice({ tone: "error", text: "לא הצלחנו לטעון את המשימות. נסה שוב." });
      setRows(arrangeTasks((data ?? []) as Task[]));
    }
    load();
    window.addEventListener(TASKS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(TASKS_CHANGED, load);
    };
  }, [gate, showNotice]);

  if (!gate) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!title.trim()) {
      showNotice({ tone: "error", text: "חסרה כותרת למשימה." });
      return;
    }
    setPending(true);
    const { error: writeError } = await gate.supabase.from("hms_tasks").insert({
      title: title.trim(),
      status: "open",
      assignee_id: gate.member.id,
      household_id: gate.member.household_id,
      created_by: gate.member.id,
    });
    setPending(false);
    if (writeError) {
      showNotice({ tone: "error", text: "לא הצלחנו להוסיף את המשימה. נסה שוב." });
      return;
    }
    const name = title.trim();
    setTitle("");
    showNotice({ tone: "ok", text: `${name} נוספה.` });
    notifyTasksChanged();
  }

  const active = (rows ?? []).filter((task) => task.status === "in_progress");
  const open = (rows ?? []).filter((task) => task.status === "open");
  const done = (rows ?? []).filter((task) => task.status === "done");
  const lede = !rows
    ? "מארגנים את הרשימה…"
    : active.length + open.length === 0
      ? "אין משימות פתוחות. אפשר להוסיף אחת למעלה."
      : `${active.length ? `${active.length === 1 ? "אחת בטיפול" : `${active.length} בטיפול`} · ` : ""}${open.length === 1 ? "אחת פתוחה" : `${open.length} פתוחות`}`;

  return (
    <>
      <PageHead title="משימות" lede={lede} />
      <form className="row add card composer" onSubmit={save}>
        <input
          value={title}
          aria-label="משימה חדשה"
          placeholder="משימה חדשה"
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "שומר…" : "הוספה"}</button>
      </form>
      {!rows ? <Skeleton rows={4} /> : null}
      {rows && rows.length === 0 ? <Empty title="אין משימות" hint="כתבו כותרת למעלה. תאריך ואחראי נשמרים בעריכה." /> : null}
      {rows && rows.length > 0 ? (
        <div className="tasks-board">
          <TaskGroup storageKey="tasks-active" title="בטיפול" count={active.length} tasks={active} />
          <TaskGroup storageKey="tasks-open" title="פתוחות" count={open.length} tasks={open} />
          <TaskGroup storageKey="tasks-done" title="בוצעו לאחרונה" count={done.length} tasks={done} />
        </div>
      ) : null}
    </>
  );
}
