"use client";

import { X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ActionNotice = {
  tone: "ok" | "error";
  text: string;
  undo?: () => void;
};

const NoticeContext = createContext<{
  showNotice: (next: ActionNotice) => void;
} | null>(null);

export function useActionNotice() {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("ActionNoticeProvider חסר");
  return value;
}

export function ActionNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ActionNotice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.undo ? 4500 : 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={{ showNotice: setNotice }}>
      {children}
      {notice ? (
        <p className={notice.tone === "error" ? "alert action-notice" : "action-notice"} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <span className="action-notice-actions">
            {notice.undo ? (
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => {
                  notice.undo?.();
                  setNotice(null);
                }}
              >
                ביטול
              </button>
            ) : null}
            <button className="action-notice-close" type="button" aria-label="סגירה" onClick={() => setNotice(null)}>
              <X size={16} aria-hidden="true" />
            </button>
          </span>
        </p>
      ) : null}
    </NoticeContext.Provider>
  );
}
