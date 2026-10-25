"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { IconButton } from "@/components/menu";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-back" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <IconButton label="סגירה" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
