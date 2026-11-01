"use client";

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
    if (!notice || notice.tone !== "ok") return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={{ showNotice: setNotice }}>
      {children}
      {notice ? (
        <p className={notice.tone === "error" ? "alert action-notice" : "action-notice"} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          {notice.undo ? (
            <button className="btn btn-quiet" type="button" onClick={notice.undo}>
              ביטול
            </button>
          ) : null}
        </p>
      ) : null}
    </NoticeContext.Provider>
  );
}
