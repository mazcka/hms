"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";
import { WISH_STATUS } from "@/lib/labels";

type Wish = {
  id: string;
  title: string;
  for_label: string | null;
  url: string | null;
  notes: string | null;
  priority: number;
  status: keyof typeof WISH_STATUS;
};

const blank = { title: "", for_label: "", url: "", notes: "", priority: "0", status: "idea" as Wish["status"] };

export default function WishesPage() {
  const gate = useHousehold();
  const [rows, setRows] = useState<Wish[] | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  async function load() {
    if (!gate) return;
    const { data, error: queryError } = await gate.supabase
      .from("hms_wishes")
      .select("id, title, for_label, url, notes, priority, status")
      .eq("household_id", gate.member.household_id)
      .order("priority", { ascending: false });
    if (queryError) setError(queryError.message);
    setRows((data ?? []) as Wish[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.title.trim()) {
      setError("חסרה כותרת.");
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_wishes").insert({
      household_id: gate.member.household_id,
      title: form.title.trim(),
      for_label: form.for_label.trim() || null,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
      priority: Number(form.priority) || 0,
      status: form.status,
      created_by: gate.member.id,
    });
    if (writeError) setError(writeError.message);
    else {
      setForm(blank);
      await load();
    }
  }

  async function setStatus(row: Wish, status: Wish["status"]) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_wishes").update({ status }).eq("id", row.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function remove(id: string) {
    if (!gate) return;
    if (!window.confirm("למחוק את המשאלה?")) return;
    const { error: writeError } = await gate.supabase.from("hms_wishes").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  return (
    <>
      <h1>משאלות</h1>
      <p className="lede">רעיון, החלטה לקנות, או שכבר נקנה.</p>
      <Alert>{error}</Alert>
      <form className="card stack" onSubmit={save}>
        <label>
          כותרת
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          עבור מי
          <input value={form.for_label} onChange={(e) => setForm({ ...form, for_label: e.target.value })} />
        </label>
        <label>
          קישור
          <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </label>
        <label>
          עדיפות
          <input inputMode="numeric" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
        </label>
        <label>
          הערות
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button className="btn btn-primary" type="submit">הוספה</button>
      </form>
      {!rows ? <p>טוען…</p> : null}
      {rows && rows.length === 0 ? <Empty title="רשימת המשאלות ריקה" /> : null}
      {rows?.map((row) => (
        <article className="card" key={row.id}>
          <div className="spread">
            <h2>{row.title}</h2>
            <span className="meta">עדיפות {row.priority}</span>
          </div>
          <p className="meta">{row.for_label || "בלי שם"} · {WISH_STATUS[row.status]}</p>
          {row.notes ? <p>{row.notes}</p> : null}
          {row.url ? <p><a href={row.url}>קישור</a></p> : null}
          <div className="row">
            {(Object.keys(WISH_STATUS) as Wish["status"][]).map((status) => (
              <button key={status} className="btn btn-quiet" type="button" aria-pressed={row.status === status} onClick={() => setStatus(row, status)}>
                {WISH_STATUS[status]}
              </button>
            ))}
            <button className="btn btn-danger" type="button" onClick={() => remove(row.id)}>מחיקה</button>
          </div>
        </article>
      ))}
    </>
  );
}
