"use client";

import { useState } from "react";
import { Check, Circle, Clock3, Pencil, Trash2 } from "lucide-react";
import { useHousehold } from "@/components/auth-provider";
import { IconButton, MenuItem, RowMenu } from "@/components/menu";
import { MemberMark } from "@/components/member-mark";
import { SwipeRow } from "@/components/swipe-row";
import { useTaskEditor } from "@/components/task-editor";
import { WEEKDAYS } from "@/lib/labels";
import type { Task } from "@/lib/task";

export function TaskLine({ task }: { task: Task }) {
  const gate = useHousehold();
  const editor = useTaskEditor();
  const [busy, setBusy] = useState(false);
  if (!gate) return null;
  const assignee = gate.members.find((member) => member.id === task.assignee_id);
  const done = task.status === "done";

  async function mark(status: Task["status"]) {
    setBusy(true);
    await editor.setStatus(task, status);
    setBusy(false);
  }

  const when = [task.due_date, task.weekday !== null ? WEEKDAYS[task.weekday] : ""].filter(Boolean).join(" ");

  return (
    <SwipeRow
      startActions={[
        {
          label: done ? "פתיחה" : "בוצע",
          icon: done ? <Circle aria-hidden="true" /> : <Check aria-hidden="true" />,
          onSelect: () => mark("done"),
        },
        {
          label: "בטיפול",
          icon: <Clock3 aria-hidden="true" />,
          onSelect: () => mark("in_progress"),
          tone: "warning",
        },
      ]}
      endActions={[
        { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => editor.open(task) },
        { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => editor.remove(task), tone: "danger" },
      ]}
    >
      <IconButton label={done ? "פתוח מחדש" : "בוצע"} aria-pressed={done} disabled={busy} onClick={() => mark("done")}>
          {done ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
        </IconButton>
        <button className="row-open" type="button" onClick={() => editor.open(task)}>
          <span className={done ? "bought" : undefined}>{task.title}</span>
          {when || assignee ? (
            <span className="meta">
              {when}
              {assignee ? <MemberMark name={assignee.display_name} /> : null}
            </span>
          ) : null}
        </button>
        <RowMenu>
          <MenuItem onSelect={() => mark("in_progress")}>בטיפול</MenuItem>
          <MenuItem onSelect={() => editor.open(task)}>עריכה</MenuItem>
          <MenuItem danger onSelect={() => editor.remove(task)}>מחיקה</MenuItem>
        </RowMenu>
    </SwipeRow>
  );
}
