"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

export function CollapsibleSection({
  storageKey,
  title,
  action,
  handle,
  children,
  defaultOpen = true,
  className = "",
}: {
  storageKey: string;
  title: ReactNode;
  action?: ReactNode;
  handle?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  useEffect(() => {
    const stored = window.localStorage.getItem(`hms-section:${storageKey}`);
    if (stored !== null) setOpen(stored === "open");
  }, [storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem(`hms-section:${storageKey}`, next ? "open" : "closed");
      return next;
    });
  }

  return (
    <section className={`card collapsible-section ${open ? "collapsible-section-open" : ""} ${className}`.trim()}>
      <div className="collapsible-head">
        {handle}
        <button
          className="collapsible-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
        >
          <ChevronDown aria-hidden="true" />
          <span>{title}</span>
        </button>
        {action ? <div className="collapsible-action">{action}</div> : null}
      </div>
      <div id={contentId} className="collapsible-content" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
