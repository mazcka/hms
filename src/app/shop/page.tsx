"use client";

import { Check, Circle, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { DragHandle, reorder, useDragSort } from "@/components/drag-handle";
import { IconButton, MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Alert, Empty, ItemLabel, PageHead, Skeleton } from "@/components/ui";
import { notifyRefresh } from "@/lib/task";
import { formatParsedAmount, parseShoppingText } from "@/lib/shop-list";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  bought: boolean;
  one_off: boolean;
  sort_order: number;
};
type List = { id: string; name: string; sort_order: number; hms_shop_items: Item[] };
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
  const [addingItems, setAddingItems] = useState(false);
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const listsRoot = useRef<HTMLDivElement>(null);
  const itemRoots = useRef(new Map<string, HTMLUListElement>());
  const drag = useDragSort();

  async function load() {
    if (!gate) return;
    const { data, error: queryError } = await gate.supabase
      .from("hms_shop_lists")
      .select("id, name, sort_order, hms_shop_items(id, name, quantity, unit, bought, one_off, sort_order)")
      .eq("household_id", gate.member.household_id)
      .order("name");
    if (queryError) setError(queryError.message);
    const rows = ((data ?? []) as List[])
      .map((list) => ({
        ...list,
        hms_shop_items: [...(list.hms_shop_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
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
      setAddingItems(false);
      await load();
    }
  }

  async function toggle(item: Item) {
    if (!gate) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_items").update({ bought: !item.bought }).eq("id", item.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  async function removeItem(item: Item) {
    if (!gate || !window.confirm(`למחוק את "${item.name}" מהרשימה?`)) return;
    const { error: writeError } = await gate.supabase.from("hms_shop_items").delete().eq("id", item.id);
    if (writeError) setError(writeError.message);
    else await load();
  }

  function moveItems(listId: string, from: number, to: number) {
    const next = (listsRef.current ?? []).map((list) => (
      list.id === listId ? { ...list, hms_shop_items: reorder(list.hms_shop_items, from, to) } : list
    ));
    listsRef.current = next;
    setLists(next);
  }

  function moveLists(from: number, to: number) {
    const next = reorder(listsRef.current ?? [], from, to);
    listsRef.current = next;
    setLists(next);
  }

  async function saveOrder(table: "hms_shop_items" | "hms_shop_lists", rows: { id: string; sort_order: number }[]) {
    if (!gate) return;
    const changed = rows
      .map((row, index) => ({ id: row.id, sort_order: (index + 1) * 1000, previous: row.sort_order }))
      .filter((row) => row.sort_order !== row.previous);
    if (changed.length === 0) return;
    const results = await Promise.all(changed.map((row) => (
      gate.supabase.from(table).update({ sort_order: row.sort_order }).eq("id", row.id)
    )));
    const message = results.find((result) => result.error)?.error?.message;
    if (message) {
      setError(message);
      await load();
      return;
    }
    const order = new Map(changed.map((row) => [row.id, row.sort_order]));
    setLists((current) => {
      const next = (current ?? []).map((list) => ({
        ...list,
        sort_order: order.get(list.id) ?? list.sort_order,
        hms_shop_items: list.hms_shop_items.map((item) => ({
          ...item,
          sort_order: order.get(item.id) ?? item.sort_order,
        })),
      }));
      listsRef.current = next;
      return next;
    });
    notifyRefresh();
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
      <PageHead title="קניות" action={<button className="btn btn-primary" type="button" onClick={() => setAddingItems(true)}>פריטים</button>} />
      <Alert>{error}</Alert>
      <Sheet open={addingItems} title="פריטים חדשים" onClose={() => setAddingItems(false)}>
      <form className="stack" onSubmit={addItem}>
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
          <IconButton label="קטגוריה חדשה" onClick={() => { setError(""); setAddingList(true); }}>
            <Plus size={18} aria-hidden="true" />
          </IconButton>
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
      </Sheet>
      {addingList ? (
        <div className="modal-back" role="presentation" onClick={() => setAddingList(false)}>
          <form className="modal" role="dialog" aria-modal="true" aria-label="קטגוריה חדשה" onClick={(e) => e.stopPropagation()} onSubmit={addList}>
            <header className="modal-head">
              <p className="eyebrow">קטגוריה חדשה</p>
              <IconButton label="סגירה" onClick={() => setAddingList(false)}>
                <X size={18} aria-hidden="true" />
              </IconButton>
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
      {!lists ? <Skeleton rows={3} /> : null}
      {lists && lists.length === 0 ? <Empty title="אין קטגוריות" hint="הוסיפו קטגוריה ואז פריטים." action={<button className="btn btn-primary" type="button" onClick={() => setAddingList(true)}>קטגוריה חדשה</button>} /> : null}
      <div ref={listsRoot}>
      {lists?.map((list, listIndex) => (
        <div key={list.id} data-drag-row="">
        <CollapsibleSection
          className="tone tone-shop"
          storageKey={`shop-list-${list.id}`}
          title={<h2>{list.name}</h2>}
          handle={
            <DragHandle
              label={`סידור הרשימה ${list.name}`}
              onPointerDown={(event) => drag.start(
                listIndex,
                event,
                () => listsRoot.current,
                moveLists,
                () => saveOrder("hms_shop_lists", listsRef.current ?? []),
              )}
            />
          }
          action={
            <RowMenu label={`פעולות ${list.name}`}>
              <MenuItem onSelect={() => endSession(list.id)}>סיום סשן</MenuItem>
              <MenuItem danger onSelect={() => removeList(list.id)}>מחיקת קטגוריה</MenuItem>
            </RowMenu>
          }
        >
          {(list.hms_shop_items ?? []).length === 0 ? <Empty title="אין פריטים בקטגוריה" /> : null}
          <ul
            className="stack"
            ref={(node) => {
              if (node) itemRoots.current.set(list.id, node);
              else itemRoots.current.delete(list.id);
            }}
          >
            {(list.hms_shop_items ?? []).map((item, itemIndex) => (
              <SwipeRow
                key={item.id}
                sortable
                startActions={[{
                  label: item.bought ? "להחזיר" : "נקנה",
                  icon: item.bought ? <Circle aria-hidden="true" /> : <Check aria-hidden="true" />,
                  onSelect: () => toggle(item),
                }]}
                endActions={[{
                  label: "מחיקה",
                  icon: <Trash2 aria-hidden="true" />,
                  onSelect: () => removeItem(item),
                  tone: "danger",
                }]}
              >
                <IconButton
                  label={item.bought ? `בטל סימון של ${item.name}` : `סמן את ${item.name} כנקנה`}
                  aria-pressed={item.bought}
                  onClick={() => toggle(item)}
                >
                  {item.bought ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                </IconButton>
                <div className="row-open shop-pair">
                  <span className="shop-amount">{formatAmount(item) || "–"}</span>
                  <span className={item.bought ? "bought" : undefined}>
                    <ItemLabel value={item.name} />
                    {item.one_off ? <span className="meta"> חד-פעמי</span> : null}
                  </span>
                </div>
                <DragHandle
                  label={`סידור ${item.name}`}
                  onPointerDown={(event) => drag.start(
                    itemIndex,
                    event,
                    () => itemRoots.current.get(list.id) ?? null,
                    (from, to) => moveItems(list.id, from, to),
                    () => {
                      const items = listsRef.current?.find((row) => row.id === list.id)?.hms_shop_items ?? [];
                      return saveOrder("hms_shop_items", items);
                    },
                  )}
                />
                <RowMenu label={`פעולות עבור ${item.name}`}>
                  <MenuItem danger onSelect={() => removeItem(item)}>מחיקה</MenuItem>
                </RowMenu>
              </SwipeRow>
            ))}
          </ul>
        </CollapsibleSection>
        </div>
      ))}
      </div>
    </>
  );
}
