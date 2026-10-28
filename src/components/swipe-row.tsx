"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type SwipeAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void | Promise<void>;
  tone?: "primary" | "warning" | "danger";
};

const ACTION_WIDTH = 76;
const DRAG_SLOP = 8;

export function SwipeRow({
  children,
  startActions = [],
  endActions = [],
  className = "",
  sortable = false,
}: {
  children: ReactNode;
  startActions?: SwipeAction[];
  endActions?: SwipeAction[];
  className?: string;
  sortable?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, y: 0, offset: 0 });
  const horizontal = useRef<boolean | null>(null);
  const moved = useRef(false);

  const startWidth = startActions.length * ACTION_WIDTH;
  const endWidth = endActions.length * ACTION_WIDTH;

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-drag-handle]")) return;
    origin.current = { x: event.clientX, y: event.clientY, offset };
    horizontal.current = null;
    moved.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (horizontal.current === null && Math.max(Math.abs(dx), Math.abs(dy)) > DRAG_SLOP) {
      horizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!horizontal.current) return;
    event.preventDefault();
    moved.current = true;
    const next = origin.current.offset + dx;
    setOffset(Math.max(-endWidth, Math.min(startWidth, next)));
  }

  function finish() {
    if (!dragging) return;
    setDragging(false);
    if (!horizontal.current) return;
    const width = offset > 0 ? startWidth : endWidth;
    setOffset(width && Math.abs(offset) >= Math.min(44, width / 2) ? Math.sign(offset) * width : 0);
  }

  async function run(action: SwipeAction) {
    setOffset(0);
    await action.onSelect();
  }

  function actions(items: SwipeAction[], side: "start" | "end") {
    if (!items.length) return null;
    return (
      <div className={`swipe-actions swipe-actions-${side}`} aria-label={side === "start" ? "פעולות בהחלקה ימינה" : "פעולות בהחלקה שמאלה"}>
        {items.map((action) => (
          <button
            className={`swipe-action swipe-action-${action.tone ?? "primary"}`}
            key={action.label}
            type="button"
            onClick={() => run(action)}
            tabIndex={offset === 0 || Math.sign(offset) !== (side === "start" ? 1 : -1) ? -1 : 0}
            aria-label={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <li
      data-drag-row={sortable ? "" : undefined}
      className={`swipe-row ${offset ? "swipe-row-open" : ""} ${className}`.trim()}
      style={{ "--swipe-offset": `${offset}px` } as CSSProperties}
    >
      {actions(startActions, "start")}
      {actions(endActions, "end")}
      <div
        className={`swipe-content ${dragging ? "swipe-content-dragging" : ""}`}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onClickCapture={(event) => {
          if (!moved.current) return;
          event.preventDefault();
          event.stopPropagation();
          moved.current = false;
        }}
      >
        {children}
      </div>
    </li>
  );
}
