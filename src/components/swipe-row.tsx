"use client";

import {
  useEffect,
  useRef,
  useState,
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
  tone = "quiet",
  sortable = false,
}: {
  children: ReactNode;
  startActions?: SwipeAction[];
  endActions?: SwipeAction[];
  className?: string;
  tone?: "quiet" | "active" | "settled";
  sortable?: boolean;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);
  const origin = useRef({ x: 0, y: 0, offset: 0 });
  const horizontal = useRef<boolean | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setRowWidth(row.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  function trayLimit(count: number) {
    if (!count) return 0;
    const natural = count * ACTION_WIDTH;
    return rowWidth ? Math.min(natural, rowWidth) : natural;
  }

  const startWidth = trayLimit(startActions.length);
  const endWidth = trayLimit(endActions.length);

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    const blocked = target.closest("[data-drag-handle], a, input, textarea, select, button");
    if (blocked && !blocked.classList.contains("row-open")) return;
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

  function actions(items: SwipeAction[], side: "start" | "end", width: number) {
    if (!items.length) return null;
    const open = side === "start" ? offset > 0 : offset < 0;
    return (
      <div
        className={`swipe-actions swipe-actions-${side}`}
        style={{ width }}
        aria-hidden={open ? undefined : true}
        aria-label={side === "start" ? "פעולות בהחלקה ימינה" : "פעולות בהחלקה שמאלה"}
      >
        {items.map((action) => (
          <button
            className={`swipe-action swipe-action-${action.tone ?? "primary"}`}
            key={action.label}
            type="button"
            onClick={() => run(action)}
            tabIndex={open ? 0 : -1}
            aria-label={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const startReveal = offset > 0 ? offset : 0;
  const endReveal = offset < 0 ? -offset : 0;

  return (
    <li
      ref={rowRef}
      data-drag-row={sortable ? "" : undefined}
      className={`swipe-row ${offset ? "swipe-row-open" : ""} ${dragging ? "swipe-row-dragging" : ""} ${className}`.trim()}
    >
      {actions(startActions, "start", startReveal)}
      <div
        className={`swipe-content status-${tone} ${dragging ? "swipe-content-dragging" : ""}`}
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
      {actions(endActions, "end", endReveal)}
    </li>
  );
}
