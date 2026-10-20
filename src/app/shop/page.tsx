"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { Alert, Empty } from "@/components/ui";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  bought: boolean;
  one_off: boolean;
};
type List = { id: string; name: string; hms_shop_items: Item[] };

export default function ShopPage() {
  const gate = useHousehold();
  const [lists, setLists] = useState<List[] | null>(null);
  const [listName, setListName] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [oneOff, setOneOff] = useState(false);
  const [listId, setListId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    const { error: writeError } = await gate.supabase.from("hms_shop_lists").insert({
      household_id: gate.member.household_id,
      name: listName.trim(),
    });
    setPending(false);
    if (writeError) setError(writeError.message);
    else {
      setListName("");
      await load();
    }
  }

  async function addItem(event?: FormEvent) {
    event?.preventDefault();
    if (!gate) return;
    const names = itemName
      .split(/[\n,]+/)
      .flatMap((line) => line.trim().split(/\s+/))
      .map((name) => name.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!listId || names.length === 0) {
      setError("בחרו קטגוריה והקלידו לפחות פריט אחד.");
      return;
    }
    setPending(true);
    setError("");
    const single = names.length === 1;
    const { error: writeError } = await gate.supabase.from("hms_shop_items").insert(
      names.map((name) => ({
        household_id: gate.member.household_id,
        list_id: listId,
        name,
        quantity: single && quantity ? Number(quantity) : null,
        unit: single ? unit.trim() || null : null,
        one_off: oneOff,
      })),
    );
    setPending(false);
    if (writeError) setError(writeError.message);
    else {
      setItemName("");
      setQuantity("");
      setUnit("");
      setOneOff(false);
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
    setError("");
    const deleted = await gate.supabase.from("hms_shop_items").delete().eq("list_id", id).eq("one_off", true);
    if (deleted.error) {
      setError(deleted.error.message);
      return;
    }
    const cleared = await gate.supabase.from("hms_shop_items").update({ bought: false }).eq("list_id", id);
    if (cleared.error) setError(cleared.error.message);
    else await load();
  }

  async function removeList(id: string) {
    if (!gate) return;
    if (!window.confirm("למחוק את הקטגוריה ואת הפריטים שלה?")) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_lists").delete().eq("id", id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  return (
    <>
      <h1>קניות</h1>
      <Alert>{error}</Alert>
      <details className="add card">
      <summary>קטגוריה או פריט</summary>
      <form className="stack" onSubmit={addList}>
        <h2>קטגוריה חדשה</h2>
        <label>
          שם
          <input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="סופר, טמבוריה…" />
        </label>
        <button className="btn btn-primary" disabled={pending} type="submit">הוספת קטגוריה</button>
      </form>
      <form className="stack" onSubmit={addItem}>
        <h2>פריט</h2>
        <label>
          קטגוריה
          <select value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">בחירה</option>
            {(lists ?? []).map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </label>
        <label>
          פריטים
          <textarea
            value={itemName}
            rows={3}
            placeholder="חלב ביצים שוקו. Enter מוסיף הכל. מוצר משתי מילים: גבינה-צהובה"
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void addItem();
              }
            }}
          />
        </label>
        <label>
          כמות
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label>
          יחידה
          <input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={oneOff} onChange={(e) => setOneOff(e.target.checked)} />
          חד-פעמי, יימחק בסיום הסשן
        </label>
        <button className="btn btn-primary" disabled={pending} type="submit">הוספת פריט</button>
      </form>
      </details>
      {!lists ? <p>טוען…</p> : null}
      {lists && lists.length === 0 ? <Empty title="אין קטגוריות" /> : null}
      {lists?.map((list) => (
        <section className="card tone tone-shop" key={list.id}>
          <div className="spread">
            <h2>{list.name}</h2>
            <button className="btn btn-danger" type="button" onClick={() => removeList(list.id)}>מחיקת קטגוריה</button>
          </div>
          {(list.hms_shop_items ?? []).length === 0 ? <Empty title="אין פריטים בקטגוריה" /> : null}
          <ul className="stack">
            {(list.hms_shop_items ?? []).map((item) => (
              <li key={item.id} className="spread">
                <button className="btn btn-quiet" type="button" onClick={() => toggle(item)} aria-pressed={item.bought}>
                  <span className={item.bought ? "bought" : undefined}>
                    {item.name}
                    {item.quantity ? ` · ${item.quantity}` : ""}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.one_off ? " · חד-פעמי" : ""}
                  </span>
                </button>
                <span className="meta">{item.bought ? "נקנה" : "לא נקנה"}</span>
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary" type="button" onClick={() => endSession(list.id)}>סיום סשן</button>
        </section>
      ))}
    </>
  );
}
