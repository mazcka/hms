"use client";

import { useState } from "react";
import { useHousehold } from "@/components/auth-provider";
import { MemberMark } from "@/components/member-mark";
import { useTaskEditor } from "@/components/task-editor";
import { TASK_STATUS, WEEKDAYS } from "@/lib/labels";
import type { Task } from "@/lib/task";

export function TaskLine({ task }: { task: Task }) {
  const gate = useHousehold();
  const editor = useTaskEditor();
  const [busy, setBusy] = useState(false);
  if (!gate) return null;
  const assignee = gate.members.find((member) => member.id === task.assignee_id);

  async function mark(status: Task["status"]) {
    setBusy(true);
    await editor.setStatus(task, status);
    setBusy(false);
  }

  return (
    <li className="task-line">
      <div className="task-line-main">
        {assignee ? <MemberMark name={assignee.display_name} /> : null}
        <div>
          <p className={task.status === "done" ? "bought" : undefined}>{task.title}</p>
          <p className="meta">
            {TASK_STATUS[task.status]}
            {task.due_date ? ` · ${task.due_date}` : ""}
            {task.weekday !== null ? ` · ${WEEKDAYS[task.weekday]}` : ""}
          </p>
        </div>
      </div>
      <div className="task-actions">
        <button
          className="icon-btn icon-btn-progress"
          type="button"
          aria-pressed={task.status === "in_progress"}
          aria-label="בטיפול"
          disabled={busy}
          onClick={() => mark("in_progress")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.28" />
            <path d="M12 4a8 8 0 0 1 7.5 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </button>
        <button
          className="icon-btn icon-btn-done"
          type="button"
          aria-pressed={task.status === "done"}
          aria-label="בוצע"
          disabled={busy}
          onClick={() => mark("done")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 12.5 4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="icon-btn" type="button" aria-label="עריכה" onClick={() => editor.open(task)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4l10-10-4-4L4 16z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m13 7 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
    </li>
  );
}
