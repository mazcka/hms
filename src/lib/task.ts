export type Task = {
  id: string;
  title: string;
  details: string | null;
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  due_time: string | null;
  weekday: number | null;
  assignee_id: string | null;
  updated_at?: string | null;
};

export const TASK_FIELDS = "id, title, details, status, due_date, due_time, weekday, assignee_id, updated_at";

export const DONE_VISIBLE_DAYS = 7;

export function arrangeTasks(tasks: Task[]) {
  const cutoff = Date.now() - DONE_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  return tasks
    .filter((task) => {
      if (task.status !== "done") return true;
      if (!task.updated_at) return true;
      return new Date(task.updated_at).getTime() >= cutoff;
    })
    .sort((a, b) => {
      const rank = (status: Task["status"]) => (status === "in_progress" ? 0 : status === "done" ? 2 : 1);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      if (a.status === "done") return (a.updated_at ?? "").localeCompare(b.updated_at ?? "");
      const dueA = a.due_date ?? "9999-99-99";
      const dueB = b.due_date ?? "9999-99-99";
      return dueA.localeCompare(dueB);
    });
}

export const TASKS_CHANGED = "hms-tasks-changed";

export const HMS_REFRESH = "hms-refresh";

export function notifyTasksChanged() {
  window.dispatchEvent(new Event(TASKS_CHANGED));
  window.dispatchEvent(new Event(HMS_REFRESH));
}

export function notifyRefresh() {
  window.dispatchEvent(new Event(HMS_REFRESH));
}
