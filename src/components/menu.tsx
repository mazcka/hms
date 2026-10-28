"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { MoreHorizontal } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MenuCloseContext = createContext<() => void>(() => {});

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={400}>{children}</Tooltip.Provider>;
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side="top" sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className={className ? `icon-btn ${className}` : "icon-btn"} type="button" aria-label={label} {...props}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side="top" sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function RowMenu({ label = "עוד", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 180;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setBox({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <MenuCloseContext.Provider value={() => setOpen(false)}>
      <button
        ref={triggerRef}
        className="icon-btn row-menu"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && box ? createPortal(
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          style={{ position: "fixed", top: box.top, left: box.left, zIndex: 80 }}
        >
          {children}
        </div>,
        document.body,
      ) : null}
    </MenuCloseContext.Provider>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      className={danger ? "menu-item menu-danger" : "menu-item"}
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {icon ? <span className="menu-icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
