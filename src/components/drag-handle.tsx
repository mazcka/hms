"use client";

import { GripVertical } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export function reorder<T>(rows: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export function DragHandle({
  label,
  onPointerDown,
}: {
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="drag-handle"
      type="button"
      aria-label={label}
      data-drag-handle=""
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical aria-hidden="true" />
    </button>
  );
}

export function useDragSort() {
  const drag = useRef<{ index: number; pointerId: number } | null>(null);

  function start(
    index: number,
    event: ReactPointerEvent<HTMLButtonElement>,
    getRoot: () => HTMLElement | null,
    onMove: (from: number, to: number) => void,
    onEnd: () => void,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    let changed = false;
    drag.current = { index, pointerId };
    const row = event.currentTarget.closest<HTMLElement>("[data-drag-row]");
    row?.classList.add("drag-row-active");

    function neighbor(direction: -1 | 1, pointerY: number) {
      const root = getRoot();
      const current = drag.current;
      if (!root || !current) return;
      const rows = [...root.querySelectorAll<HTMLElement>(":scope > [data-drag-row]")];
      const nextIndex = current.index + direction;
      const edge = rows[nextIndex]?.getBoundingClientRect();
      if (!edge) return;
      const crossed = direction > 0
        ? pointerY > edge.top + edge.height / 2
        : pointerY < edge.top + edge.height / 2;
      if (!crossed) return;
      const from = current.index;
      drag.current = { index: nextIndex, pointerId };
      changed = true;
      onMove(from, nextIndex);
    }

    let lastY = event.clientY;
    let frame = false;

    function move(native: PointerEvent) {
      if (native.pointerId !== pointerId || !drag.current || frame) return;
      native.preventDefault();
      const direction = native.clientY >= lastY ? 1 : -1;
      lastY = native.clientY;
      const before = drag.current.index;
      neighbor(direction, native.clientY);
      if (drag.current && drag.current.index !== before) {
        frame = true;
        requestAnimationFrame(() => {
          frame = false;
        });
      }
    }

    function finish(native: PointerEvent) {
      if (native.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      getRoot()?.querySelector(".drag-row-active")?.classList.remove("drag-row-active");
      drag.current = null;
      if (changed) onEnd();
    }

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  return { start };
}
