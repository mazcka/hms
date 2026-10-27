"use client";

import { Check, ListPlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Alert, Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { HMS_REFRESH, notifyRefresh } from "@/lib/task";
import { WISH_STATUS } from "@/lib/labels";

type Person = { id: string; name: string };
type Wish = {
  id: string;
  title: string;
  for_person_id: string | null;
  for_label: string | null;
  url: string | null;
  notes: string | null;
  priority: number;
  status: keyof typeof WISH_STATUS;
};

const blank = { title: "", for_person_id: "", for_label: "", url: "", notes: "", priority: "0", status: "idea" as Wish["status"] };

export default function WishesPage() {
  const gate = useHousehold();
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Wish[] | null>(null);
  const [form, setForm] = useState(blank);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!gate) return;
    const [w, p] = await Promise.all([
      gate.supabase.from("hms_wishes").select("id, title, for_person_id, for_label, url, notes, priority, status").eq("household_id", gate.member.household_id).order("priority", { ascending: false }),
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id).order("name"),
    ]);
    if (w.error || p.error) setError(w.error?.message || p.error?.message || "");
    setRows((w.data ?? []) as Wish[]);
    setPeople((p.data ?? []) as Person[]);
  }

  useEffect(() => {
    load();
    function onRefresh() {
      load();
    }
    window.addEventListener(HMS_REFRESH, onRefresh);
    return () => window.removeEventListener(HMS_REFRESH, onRefresh);
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
    const payload = {
      household_id: gate.member.household_id,
      title: form.title.trim(),
      for_person_id: form.for_person_id || null,
      for_label: form.for_label.trim() || null,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
      priority: Number(form.priority) || 0,
      status: form.status,
      created_by: gate.member.id,
    };
    const write = editingId
      ? gate.supabase.from("hms_wishes").update(payload).eq("id", editingId)
      : gate.supabase.from("hms_wishes").insert(payload);
    const { error: writeError } = await write;
    if (writeError) setError(writeError.message);
    else {
      setForm(blank);
      setEditingId(null);
      setComposer(false);
      await load();
    }
  }

  function startEdit(row: Wish) {
    setForm({
      title: row.title,
      for_person_id: row.for_person_id ?? "",
      for_label: row.for_label ?? "",
      url: row.url ?? "",
      notes: row.notes ?? "",
      priority: String(row.priority),
      status: row.status,
    });
    setEditingId(row.id);
    setComposer(true);
    setError("");
  }

  function advanceStatus(row: Wish) {
    const next: Record<Wish["status"], Wish["status"]> = {
      idea: "planned",
      planned: "bought",
      bought: "idea",
    };
    return setStatus(row, next[row.status]);
  }

  async function setStatus(row: Wish, status: Wish["status"]) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_wishes").update({ status }).eq("id", row.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function toShop(row: Wish) {
    if (!gate) return;
    setError("");
    const lists = await gate.supabase
      .from("hms_shop_lists")
      .select("id")
      .eq("household_id", gate.member.household_id)
      .order("name")
      .limit(1);
    if (lists.error) {
      setError(lists.error.message);
      return;
    }
    let listId = (lists.data?.[0] as { id: string } | undefined)?.id;
    if (!listId) {
      const created = await gate.supabase
        .from("hms_shop_lists")
        .insert({ household_id: gate.member.household_id, name: "קניות" })
        .select("id")
        .single();
      if (created.error) {
        setError(created.error.message);
        return;
      }
      listId = (created.data as { id: string }).id;
    }
    const { error: writeError } = await gate.supabase.from("hms_shop_items").insert({
      household_id: gate.member.household_id,
      list_id: listId,
      name: row.title,
      one_off: true,
    });
    if (writeError) {
      setError(writeError.message);
      return;
    }
    await gate.supabase.from("hms_wishes").update({ status: "bought" }).eq("id", row.id);
    notifyRefresh();
    await load();
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
      <PageHead title="משאלות" action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>משאלה חדשה</button>} />
      <Alert>{error}</Alert>
      <Sheet open={composer} title={editingId ? "עריכת משאלה" : "משאלה חדשה"} onClose={() => { setComposer(false); setEditingId(null); setForm(blank); }}>
      <form className="stack" onSubmit={save}>
        <label>
          כותרת
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <details>
          <summary>עוד פרטים</summary>
          <div className="stack">
            <label>
              עבור
              <select value={form.for_person_id} onChange={(e) => setForm({ ...form, for_person_id: e.target.value })}>
                <option value="">בלי שיוך</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
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
          </div>
        </details>
        <button className="btn btn-primary" type="submit">{editingId ? "שמירת שינוי" : "הוספה"}</button>
      </form>
      </Sheet>
      {!rows ? <Skeleton rows={3} /> : null}
      {rows && rows.length === 0 ? <Empty title="אין משאלות" action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>משאלה חדשה</button>} /> : null}
      {rows && rows.length > 0 ? (
        <section className="card">
          <ul className="stack">
            {rows.map((row) => (
              <SwipeRow
                key={row.id}
                startActions={row.status === "planned" ? [
                  { label: "לקניות", icon: <ListPlus aria-hidden="true" />, onSelect: () => toShop(row) },
                  { label: "הבא", icon: <Check aria-hidden="true" />, onSelect: () => advanceStatus(row), tone: "warning" },
                ] : [
                  { label: "הבא", icon: <Check aria-hidden="true" />, onSelect: () => advanceStatus(row) },
                ]}
                endActions={[
                  { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => startEdit(row) },
                  { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => remove(row.id), tone: "danger" },
                ]}
              >
                <div className="row-open">
                  <span>{row.title}</span>
                  <span className="meta">
                    {WISH_STATUS[row.status]}
                    {row.for_person_id ? <PersonLink id={row.for_person_id} name={people.find((p) => p.id === row.for_person_id)?.name ?? ""} /> : null}
                    {row.url ? <a href={row.url}>קישור</a> : null}
                  </span>
                </div>
                <RowMenu>
                  <MenuItem onSelect={() => startEdit(row)}>עריכה</MenuItem>
                  {(Object.keys(WISH_STATUS) as Wish["status"][]).map((status) => (
                    <MenuItem key={status} onSelect={() => setStatus(row, status)}>{WISH_STATUS[status]}</MenuItem>
                  ))}
                  {row.status === "planned" ? <MenuItem onSelect={() => toShop(row)}>לקניות</MenuItem> : null}
                  <MenuItem danger onSelect={() => remove(row.id)}>מחיקה</MenuItem>
                </RowMenu>
              </SwipeRow>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
