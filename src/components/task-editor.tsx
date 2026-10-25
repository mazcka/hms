"use client";

import { X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useHousehold } from "@/components/auth-provider";
import { IconButton } from "@/components/menu";
import { TASK_STATUS, WEEKDAYS } from "@/lib/labels";
import { notifyTasksChanged, type Task } from "@/lib/task";

type Editor = {
  open: (task: Task) => void;
  setStatus: (task: Task, status: Task["status"]) => Promise<void>;
};

const EditorContext = createContext<Editor | null>(null);

export function useTaskEditor() {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("TaskEditorProvider חסר");
  return editor;
}

const blank = {
  title: "",
  details: "",
  status: "open" as Task["status"],
  due_date: "",
  due_time: "",
  weekday: "",
  assignee_id: "",
};

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const gate = useHousehold();
  const [task, setTask] = useState<Task | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function open(next: Task) {
    setTask(next);
    setError("");
    setConfirmDelete(false);
    setForm({
      title: next.title,
      details: next.details ?? "",
      status: next.status,
      due_date: next.due_date ?? "",
      due_time: next.due_time?.slice(0, 5) ?? "",
      weekday: next.weekday === null ? "" : String(next.weekday),
      assignee_id: next.assignee_id ?? "",
    });
  }

  async function setStatus(current: Task, status: Task["status"]) {
    if (!gate) return;
    const next = status === current.status ? "open" : status;
    const { error: writeError } = await gate.supabase
      .from("hms_tasks")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", current.id);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    notifyTasksChanged();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate || !task) return;
    if (!form.title.trim()) {
      setError("חסרה כותרת.");
      return;
    }
    setPending(true);
    setError("");
    const { error: writeError } = await gate.supabase
      .from("hms_tasks")
      .update({
        title: form.title.trim(),
        details: form.details.trim() || null,
        status: form.status,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        weekday: form.weekday === "" ? null : Number(form.weekday),
        assignee_id: form.assignee_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    setPending(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setTask(null);
    notifyTasksChanged();
  }

  useEffect(() => {
    if (!task) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setTask(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task]);

  async function remove() {
    if (!gate || !task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_tasks").delete().eq("id", task.id);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setTask(null);
    notifyTasksChanged();
  }

  return (
    <EditorContext.Provider value={{ open, setStatus }}>
      {children}
      {task && gate ? (
        <div className="modal-back" role="presentation" onClick={() => setTask(null)}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-edit-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={save}
          >
            <header className="modal-head">
              <p className="eyebrow">משימה</p>
              <IconButton label="סגירה" onClick={() => setTask(null)}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </header>
            <input
              id="task-edit-title"
              className="modal-title"
              value={form.title}
              aria-label="כותרת"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              className="modal-note"
              value={form.details}
              aria-label="פירוט"
              placeholder="פירוט"
              onChange={(e) => setForm({ ...form, details: e.target.value })}
            />
            {error ? (
              <p className="alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="segment" role="group" aria-label="סטטוס">
              {Object.entries(TASK_STATUS).map(([value, label]) => (
                <button
                  key={value}
                  className="segment-btn"
                  type="button"
                  aria-pressed={form.status === value}
                  onClick={() => setForm({ ...form, status: value as Task["status"] })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="modal-grid">
              <label>
                תאריך
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </label>
              <label>
                שעה
                <input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
              </label>
              <label>
                יום חוזר
                <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                  <option value="">בלי</option>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                אחראי
                <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                  <option value="">לא שויך</option>
                  {gate.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <footer className="modal-foot">
              <button className="btn btn-primary" disabled={pending} type="submit">
                {pending ? "שומר…" : "שמירה"}
              </button>
              <button className="text-danger" type="button" onClick={remove}>
                {confirmDelete ? "למחוק?" : "מחיקה"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </EditorContext.Provider>
  );
}
