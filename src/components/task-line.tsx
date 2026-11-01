"use client";

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
  if (!gate) return null;
  const assignee = gate.members.find((member) => member.id === task.assignee_id);
  const done = task.status === "done";
  const active = task.status === "in_progress";

  async function mark(status: Task["status"]) {
    await editor.setStatus(task, status);
  }

  const when = [task.due_date, task.weekday !== null ? WEEKDAYS[task.weekday] : ""].filter(Boolean).join(" · ");

  return (
    <SwipeRow
      startActions={[
        {
          label: done ? "פתיחה" : "בוצע",
          icon: done ? <Circle aria-hidden="true" /> : <Check aria-hidden="true" />,
          onSelect: () => mark("done"),
        },
        active
          ? {
              label: "פתוחה",
              icon: <Circle aria-hidden="true" />,
              onSelect: () => mark("open"),
              tone: "neutral",
            }
          : {
              label: "בטיפול",
              icon: <Clock3 aria-hidden="true" />,
              onSelect: () => mark("in_progress"),
              tone: "warning" as const,
            },
      ]}
      endActions={[
        { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => editor.open(task), tone: "quiet" },
        { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => editor.remove(task), tone: "danger" },
      ]}
      tone={done ? "settled" : active ? "active" : "quiet"}
    >
      <IconButton
        className="icon-btn-done"
        label={done ? `פתיחה מחדש של ${task.title}` : `סימון ${task.title} כבוצעה`}
        aria-pressed={done}
        onClick={() => mark(done ? "open" : "done")}
      >
        <Check aria-hidden="true" />
      </IconButton>
      {assignee ? <MemberMark name={assignee.display_name} /> : null}
      <button className="row-open" type="button" onClick={() => editor.open(task)}>
        <span className={done ? "bought" : undefined}>{task.title}</span>
        {when ? <span className="meta">{when}</span> : null}
      </button>
      <RowMenu>
        {active ? (
          <MenuItem icon={<Circle aria-hidden="true" />} onSelect={() => mark("open")}>פתוחה</MenuItem>
        ) : (
          <MenuItem icon={<Clock3 aria-hidden="true" />} onSelect={() => mark("in_progress")}>בטיפול</MenuItem>
        )}
        <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => editor.open(task)}>עריכה</MenuItem>
        <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => editor.remove(task)}>מחיקה</MenuItem>
      </RowMenu>
    </SwipeRow>
  );
}
