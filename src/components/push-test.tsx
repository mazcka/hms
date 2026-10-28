"use client";

import { useState } from "react";
import { useHousehold } from "@/components/auth-provider";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function installedOnIphone() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return !ios || standalone;
}

export function PushTest() {
  const gate = useHousehold();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!gate) return;
    setStatus("");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      setStatus("הדפדפן הזה לא תומך בהתראות.");
      return;
    }
    if (!installedOnIphone()) {
      setStatus("באייפון צריך לפתוח את מצקה מהאייקון במסך הבית, לא מטאב בספארי.");
      return;
    }
    if (!PUBLIC_KEY) {
      setStatus("מפתח ההתראות הציבורי חסר.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("ההרשאה לא ניתנה.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY),
        }));
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gate.session.access_token}`,
        },
        body: JSON.stringify({ subscription }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(result.error || "השליחה נכשלה.");
        return;
      }
      setStatus("ההתראה תגיע בעוד חצי דקה. אפשר לסגור את האפליקציה.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "הבדיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>בדיקת התראה</h2>
      <p className="meta">לוחצים, סוגרים את האפליקציה, ומחכים כחצי דקה.</p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
        {busy ? "שולח…" : "שלח התראה בעוד חצי דקה"}
      </button>
      {status ? <p className="meta">{status}</p> : null}
    </section>
  );
}
