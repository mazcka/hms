"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";
import { notifyRefresh } from "@/lib/task";
import { formatParsedAmount, parseShoppingText } from "@/lib/shop-list";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  bought: boolean;
  one_off: boolean;
};
type List = { id: string; name: string; hms_shop_items: Item[] };
function formatAmount(item: Item) {
  if (item.quantity != null && item.unit) return `${item.quantity} ${item.unit}`;
  if (item.quantity != null) return String(item.quantity);
  return item.unit ?? "";
}

export default function ShopPage() {
  const gate = useHousehold();
  const [lists, setLists] = useState<List[] | null>(null);
  const [listName, setListName] = useState("");
  const [draft, setDraft] = useState("");
  const [listId, setListId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [addingList, setAddingList] = useState(false);

  async function load() {
    if (!gate) return;
    const { data, error: queryError } = await gate.supabase
      .from("hms_shop_lists")
      .select("id, name, hms_shop_items(id, name, quantity, unit, bought, one_off)")
      .eq("household_id", gate.member.household_id)
      .order("name");
    if (queryError) setError(queryError.message);
    const rows = (data ?? []) as List[];
    setLists(rows);
    if (!listId && rows[0]) setListId(rows[0].id);
  }

  useEffect(() => {
    load();
    function onRefresh() {
      load();
    }
    window.addEventListener("hms-refresh", onRefresh);
    return () => window.removeEventListener("hms-refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return null;

  async function addList(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!listName.trim()) {
      setError("חסר שם קטגוריה.");
      return;
    }
    setPending(true);
    setError("");
    const created = await gate.supabase
      .from("hms_shop_lists")
      .insert({ household_id: gate.member.household_id, name: listName.trim() })
      .select("id")
      .single();
    setPending(false);
    if (created.error) setError(created.error.message);
    else {
      const id = (created.data as { id: string } | null)?.id;
      if (id) setListId(id);
      setListName("");
      setAddingList(false);
      await load();
    }
  }

  async function addItem(event?: FormEvent) {
    event?.preventDefault();
    if (!gate) return;
    const rows = parseShoppingText(draft);
    if (!listId || rows.length === 0) {
      setError("בחרו קטגוריה וכתבו לפחות פריט אחד.");
      return;
    }
    setPending(true);
    setError("");
    const { error: writeError } = await gate.supabase.from("hms_shop_items").insert(
      rows.map((row) => ({
        household_id: gate.member.household_id,
        list_id: listId,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        one_off: false,
      })),
    );
    setPending(false);
    if (writeError) setError(writeError.message);
    else {
      setDraft("");
      await load();
    }
  }

  async function toggle(item: Item) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_items").update({ bought: !item.bought }).eq("id", item.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function endSession(id: string) {
    if (!gate) return;
    const marked = (lists ?? []).find((list) => list.id === id)?.hms_shop_items.filter((item) => item.bought) ?? [];
    if (marked.length === 0) {
      setError("אין פריטים מסומנים. סמנו מה שקניתם, ואז סיימו את הסשן.");
      return;
    }
    setError("");
    const deleted = await gate.supabase.from("hms_shop_items").delete().eq("list_id", id).eq("bought", true);
    if (deleted.error) setError(deleted.error.message);
    else {
      notifyRefresh();
      await load();
    }
  }

  async function removeList(id: string) {
    if (!gate) return;
    if (!window.confirm("למחוק את הקטגוריה ואת הפריטים שלה?")) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_lists").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  const preview = parseShoppingText(draft);

  return (
    <>
      <h1>קניות</h1>
      <Alert>{error}</Alert>
      <details className="add card">
      <summary>פריט</summary>
      <form className="stack" onSubmit={addItem}>
        <h2>פריט</h2>
        <div className="category-pick">
          <label>
            קטגוריה
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">בחירה</option>
              {(lists ?? []).map((list) => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </label>
          <button className="icon-btn" type="button" aria-label="קטגוריה חדשה" onClick={() => { setError(""); setAddingList(true); }}>
            +
          </button>
        </div>
        <label>
          פריטים
          <textarea
            value={draft}
            rows={6}
            placeholder={"חלב\nביצים\n5 פיתות\n8 מלפפונים"}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        {preview.length > 0 ? (
          <ul className="shop-preview" aria-label="פריטים שייתווספו">
            {preview.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <span className="shop-amount">{formatParsedAmount(row)}</span>
                <span>{row.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <button className="btn btn-primary" disabled={pending} type="submit">הוספת פריטים</button>
      </form>
      </details>
      {addingList ? (
        <div className="modal-back" role="presentation" onClick={() => setAddingList(false)}>
          <form className="modal" role="dialog" aria-modal="true" aria-label="קטגוריה חדשה" onClick={(e) => e.stopPropagation()} onSubmit={addList}>
            <header className="modal-head">
              <p className="eyebrow">קטגוריה חדשה</p>
              <button className="icon-btn" type="button" aria-label="סגירה" onClick={() => setAddingList(false)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <label>
              שם
              <input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="סופר, טמבוריה…" autoFocus />
            </label>
            <footer className="modal-foot">
              <button className="btn btn-primary" disabled={pending} type="submit">הוספת קטגוריה</button>
            </footer>
          </form>
        </div>
      ) : null}
      {!lists ? <p>טוען…</p> : null}
      {lists && lists.length === 0 ? <Empty title="אין קטגוריות" /> : null}
      {lists?.map((list) => (
        <section className="card tone tone-shop" key={list.id}>
          <div className="category-head">
            <button className="icon-btn icon-btn-danger" type="button" aria-label={`מחיקת ${list.name}`} onClick={() => removeList(list.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8h14M9 8V6h6v2M8 8l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <h2>{list.name}</h2>
          </div>
          {(list.hms_shop_items ?? []).length === 0 ? <Empty title="אין פריטים בקטגוריה" /> : null}
          <ul className="stack">
            {(list.hms_shop_items ?? []).map((item) => (
              <li key={item.id}>
                <button className="shop-line" type="button" onClick={() => toggle(item)} aria-pressed={item.bought}>
                  <span className="shop-amount">{formatAmount(item) || "–"}</span>
                  <span className={item.bought ? "shop-line-name bought" : "shop-line-name"}>
                    {item.name}
                    {item.one_off ? <span className="meta"> · חד-פעמי</span> : null}
                  </span>
                  <svg className="shop-line-check" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 12.5 4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={item.bought ? 1 : 0.28} />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary" type="button" onClick={() => endSession(list.id)}>סיום סשן</button>
        </section>
      ))}
    </>
  );
}
