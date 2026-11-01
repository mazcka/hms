"use client";

import { Check, Lightbulb, ListPlus, Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
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

function WishGroup({
  storageKey,
  title,
  wishes,
  people,
  defaultOpen = true,
  onEdit,
  onStatus,
  onShop,
  onRemove,
}: {
  storageKey: string;
  title: string;
  wishes: Wish[];
  people: Person[];
  defaultOpen?: boolean;
  onEdit: (row: Wish) => void;
  onStatus: (row: Wish, status: Wish["status"]) => void;
  onShop: (row: Wish) => void;
  onRemove: (id: string) => void;
}) {
  if (wishes.length === 0) return null;
  return (
    <CollapsibleSection
      storageKey={storageKey}
      title={<h2>{title}</h2>}
      action={<span className="meta">{wishes.length}</span>}
      defaultOpen={defaultOpen}
      className="panel"
    >
      <ul className="stack">
        {wishes.map((row) => (
          <WishRow
            key={row.id}
            row={row}
            people={people}
            onEdit={onEdit}
            onStatus={onStatus}
            onShop={onShop}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </CollapsibleSection>
  );
}

function WishRow({
  row,
  people,
  onEdit,
  onStatus,
  onShop,
  onRemove,
}: {
  row: Wish;
  people: Person[];
  onEdit: (row: Wish) => void;
  onStatus: (row: Wish, status: Wish["status"]) => void;
  onShop: (row: Wish) => void;
  onRemove: (id: string) => void;
}) {
  const next: Record<Wish["status"], Wish["status"]> = {
    idea: "planned",
    planned: "bought",
    bought: "idea",
  };
  return (
    <SwipeRow
      tone={row.status === "bought" ? "settled" : row.status === "planned" ? "active" : "quiet"}
      startActions={row.status === "planned" ? [
        { label: "לקניות", icon: <ListPlus aria-hidden="true" />, onSelect: () => onShop(row) },
        { label: "הבא", icon: <Check aria-hidden="true" />, onSelect: () => onStatus(row, next[row.status]), tone: "warning" },
      ] : [
        { label: "הבא", icon: <Check aria-hidden="true" />, onSelect: () => onStatus(row, next[row.status]) },
      ]}
      endActions={[
        { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => onEdit(row), tone: "quiet" },
        { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => onRemove(row.id), tone: "danger" },
      ]}
    >
      <button className="row-open" type="button" onClick={() => onEdit(row)}>
        <span className={row.status === "bought" ? "bought" : undefined}>{row.title}</span>
        <span className="meta">{row.url ? "יש קישור" : row.notes ? "יש הערה" : ""}</span>
      </button>
      {row.for_person_id ? <PersonLink id={row.for_person_id} name={people.find((p) => p.id === row.for_person_id)?.name ?? ""} people={people} /> : null}
      <RowMenu>
        <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => onEdit(row)}>עריכה</MenuItem>
        {(Object.keys(WISH_STATUS) as Wish["status"][]).map((status) => (
          <MenuItem key={status} icon={status === "bought" ? <Check aria-hidden="true" /> : status === "planned" ? <ShoppingBag aria-hidden="true" /> : <Lightbulb aria-hidden="true" />} onSelect={() => onStatus(row, status)}>{WISH_STATUS[status]}</MenuItem>
        ))}
        {row.status === "planned" ? <MenuItem icon={<ListPlus aria-hidden="true" />} onSelect={() => onShop(row)}>לקניות</MenuItem> : null}
        <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => onRemove(row.id)}>מחיקה</MenuItem>
      </RowMenu>
    </SwipeRow>
  );
}

export default function WishesPage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Wish[] | null>(null);
  const [form, setForm] = useState(blank);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    if (!gate) return;
    const [w, p] = await Promise.all([
      gate.supabase.from("hms_wishes").select("id, title, for_person_id, for_label, url, notes, priority, status").eq("household_id", gate.member.household_id).order("priority", { ascending: false }),
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id).order("name"),
    ]);
    if (w.error || p.error) showNotice({ tone: "error", text: "לא הצלחנו לטעון את המשאלות. נסה שוב." });
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
      showNotice({ tone: "error", text: "חסרה כותרת." });
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
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור את המשאלה. נסה שוב." });
    else {
      showNotice({ tone: "ok", text: editingId ? `${payload.title} עודכנה.` : `${payload.title} נוספה.` });
      setForm(blank);
      setEditingId(null);
      setComposer(false);
      notifyRefresh();
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
  }

  async function setStatus(row: Wish, status: Wish["status"]) {
    if (!gate) return;
    const previous = row.status;
    const { error: writeError } = await gate.supabase.from("hms_wishes").update({ status }).eq("id", row.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לעדכן את המשאלה. נסה שוב." });
    else {
      showNotice({
        tone: "ok",
        text: `${row.title} · ${WISH_STATUS[status]}.`,
        undo: () => setStatus({ ...row, status }, previous),
      });
      notifyRefresh();
      await load();
    }
  }

  async function toShop(row: Wish) {
    if (!gate) return;
    const lists = await gate.supabase
      .from("hms_shop_lists")
      .select("id")
      .eq("household_id", gate.member.household_id)
      .order("name")
      .limit(1);
    if (lists.error) {
      showNotice({ tone: "error", text: "לא הצלחנו לפתוח את הקניות. נסה שוב." });
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
        showNotice({ tone: "error", text: "לא הצלחנו ליצור רשימת קניות. נסה שוב." });
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
      showNotice({ tone: "error", text: "לא הצלחנו להוסיף לקניות. נסה שוב." });
      return;
    }
    await gate.supabase.from("hms_wishes").update({ status: "bought" }).eq("id", row.id);
    showNotice({ tone: "ok", text: `${row.title} נוספה לקניות.` });
    notifyRefresh();
    await load();
  }

  async function remove(id: string) {
    if (!gate) return;
    const title = rows?.find((row) => row.id === id)?.title ?? "המשאלה";
    if (!window.confirm(`למחוק את "${title}"?`)) return;
    const { error: writeError } = await gate.supabase.from("hms_wishes").delete().eq("id", id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק. נסה שוב." });
    else {
      showNotice({ tone: "ok", text: `${title} נמחקה.` });
      notifyRefresh();
      await load();
    }
  }

  const ideas = (rows ?? []).filter((row) => row.status === "idea");
  const planned = (rows ?? []).filter((row) => row.status === "planned");
  const bought = (rows ?? []).filter((row) => row.status === "bought");
  const lede = !rows
    ? "מארגנים את המשאלות…"
    : rows.length === 0
      ? "אין משאלות עדיין."
    : ideas.length + planned.length === 0
      ? "אין משאלות פתוחות."
      : planned.length
        ? `${planned.length === 1 ? "אחת הוחלט לקנות" : `${planned.length} הוחלט לקנות`}${ideas.length ? ` · ${ideas.length === 1 ? "רעיון אחד" : `${ideas.length} רעיונות`}` : ""}`
        : ideas.length === 1
          ? "רעיון אחד."
          : `${ideas.length} רעיונות.`;

  return (
    <>
      <PageHead title="משאלות" lede={lede} action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>משאלה חדשה</button>} />
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
        <div className="tasks-board">
          <WishGroup storageKey="wishes-planned" title="הוחלט לקנות" wishes={planned} people={people} onEdit={startEdit} onStatus={setStatus} onShop={toShop} onRemove={remove} />
          <WishGroup storageKey="wishes-ideas" title="רעיונות" wishes={ideas} people={people} onEdit={startEdit} onStatus={setStatus} onShop={toShop} onRemove={remove} />
          <WishGroup storageKey="wishes-bought" title="נקנו" wishes={bought} people={people} defaultOpen={false} onEdit={startEdit} onStatus={setStatus} onShop={toShop} onRemove={remove} />
        </div>
      ) : null}
    </>
  );
}
