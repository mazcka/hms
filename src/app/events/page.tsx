"use client";

import { Calendar, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PlaceField } from "@/components/place-field";
import { MenuItem, RowMenu } from "@/components/menu";
import { SectionTabs } from "@/components/section-tabs";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { eventKindLabel, eventKindOptions, formatDate, todayIso } from "@/lib/labels";
import { savePushSubscription } from "@/lib/push-client";
import { notifyRefresh } from "@/lib/task";

type Person = { id: string; name: string };
type Kind = { id: string; label: string };
type EventRow = {
  id: string;
  title: string;
  kind: string;
  event_date: string;
  event_time: string | null;
  person_id: string | null;
  place: string | null;
  notes: string | null;
  remind_day_before: boolean;
};

const blank = { title: "", kind: "birthday", event_date: "", event_time: "", person_id: "", place: "", notes: "", remind_day_before: true };

function EventGroup({
  storageKey,
  title,
  events,
  kinds,
  people,
  onEdit,
  onRemove,
  empty,
  defaultOpen = true,
}: {
  storageKey: string;
  title: string;
  events: EventRow[];
  kinds: Kind[];
  people: Person[];
  onEdit: (row: EventRow) => void;
  onRemove: (id: string) => void;
  empty?: string;
  defaultOpen?: boolean;
}) {
  if (events.length === 0 && !empty) return null;
  return (
    <CollapsibleSection
      storageKey={storageKey}
      title={<h2>{title}</h2>}
      action={<span className="meta">{events.length || "פנוי"}</span>}
      defaultOpen={defaultOpen}
      className="panel"
    >
      {events.length === 0 ? <p className="agenda-empty">{empty}</p> : (
      <ul className="stack">
        {events.map((row) => (
          <SwipeRow
            key={row.id}
            endActions={[
              { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => onEdit(row) },
              { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => onRemove(row.id), tone: "danger" },
            ]}
          >
            <span className="row-mark" aria-hidden="true"><Calendar /></span>
            <button className="row-open" type="button" onClick={() => onEdit(row)}>
              <span>{row.title}</span>
              <span className="meta">
                {eventKindLabel(row.kind, kinds)} · {formatDate(row.event_date)}
                {row.event_time ? ` · ${row.event_time.slice(0, 5)}` : ""}
              </span>
            </button>
            {row.person_id ? <PersonLink id={row.person_id} name={people.find((p) => p.id === row.person_id)?.name ?? ""} people={people} /> : null}
            <RowMenu>
              <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => onEdit(row)}>עריכה</MenuItem>
              <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => onRemove(row.id)}>מחיקה</MenuItem>
            </RowMenu>
          </SwipeRow>
        ))}
      </ul>
      )}
    </CollapsibleSection>
  );
}

export default function EventsPage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [people, setPeople] = useState<Person[]>([]);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [form, setForm] = useState(blank);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    if (!gate) return;
    const [p, e, k] = await Promise.all([
      gate.supabase.from("hms_people").select("id, name").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_events").select("id, title, kind, event_date, event_time, person_id, place, notes, remind_day_before").eq("household_id", gate.member.household_id).order("event_date"),
      gate.supabase.from("hms_event_kinds").select("id, label").eq("household_id", gate.member.household_id).order("label"),
    ]);
    if (p.error || e.error) showNotice({ tone: "error", text: "לא הצלחנו לטעון את האירועים, נסה שוב." });
    setPeople((p.data ?? []) as Person[]);
    setRows((e.data ?? []) as EventRow[]);
    setKinds(k.error ? [] : (k.data ?? []) as Kind[]);
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!gate) return;
    if (!form.title.trim() || !form.event_date) {
      showNotice({ tone: "error", text: "חסרים כותרת ותאריך." });
      return;
    }
    const payload = {
      household_id: gate.member.household_id,
      title: form.title.trim(),
      kind: form.kind,
      event_date: form.event_date,
      event_time: form.event_time || null,
      person_id: form.person_id || null,
      place: form.place.trim() || null,
      notes: form.notes.trim() || null,
      remind_day_before: form.remind_day_before,
      created_by: gate.member.id,
    };
    const write = editingId
      ? gate.supabase.from("hms_events").update(payload).eq("id", editingId)
      : gate.supabase.from("hms_events").insert(payload);
    const { error: writeError } = await write;
    if (writeError) {
      showNotice({ tone: "error", text: "לא הצלחנו לשמור את האירוע, נסה שוב." });
      return;
    }
    showNotice({ tone: "ok", text: editingId ? `${payload.title} עודכן` : `${payload.title} נוסף` });
    setForm(blank);
    setEditingId(null);
    setComposer(false);
    notifyRefresh();
    await load();
  }

  function startEdit(row: EventRow) {
    setForm({
      title: row.title,
      kind: row.kind,
      event_date: row.event_date,
      event_time: row.event_time ?? "",
      person_id: row.person_id ?? "",
      place: row.place ?? "",
      notes: row.notes ?? "",
      remind_day_before: row.remind_day_before,
    });
    setEditingId(row.id);
    setComposer(true);
  }

  async function remove(id: string) {
    if (!gate) return;
    const title = rows?.find((row) => row.id === id)?.title ?? "האירוע";
    if (!window.confirm(`למחוק את "${title}"?`)) return;
    const { error: writeError } = await gate.supabase.from("hms_events").delete().eq("id", id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק את האירוע, נסה שוב." });
    else {
      showNotice({ tone: "ok", text: `${title} נמחק.` });
      notifyRefresh();
      await load();
    }
  }

  async function enableReminders() {
    if (!gate) return;
    const result = await savePushSubscription(gate.session.access_token);
    if (result === "granted") showNotice({ tone: "ok", text: "התראות פעילות. תזכורת לאירוע תגיע בבוקר של היום שלפניו, גם כשהאפליקציה סגורה." });
    else if (result === "browser") showNotice({ tone: "error", text: "באייפון צריך לפתוח את מצקה מהאייקון במסך הבית." });
    else if (result === "unsupported") showNotice({ tone: "error", text: "הדפדפן לא תומך בהתראות." });
    else if (result === "save") showNotice({ tone: "error", text: "ההרשאה ניתנה, אבל שמירת המכשיר נכשלה." });
    else showNotice({ tone: "error", text: "ההרשאה לא ניתנה." });
  }

  const today = todayIso();
  const todayRows = (rows ?? []).filter((row) => row.event_date === today);
  const laterRows = (rows ?? []).filter((row) => row.event_date > today);
  const pastRows = (rows ?? []).filter((row) => row.event_date < today);
  const upcoming = todayRows.length + laterRows.length;
  const lede = !rows
    ? "מארגנים את היומן…"
    : upcoming === 0
      ? "אין אירועים בהמשך"
      : upcoming === 1
        ? "אירוע אחד בהמשך"
        : `${upcoming} אירועים בהמשך`;

  return (
    <>
      <PageHead title="אירועים" lede={lede} action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>אירוע חדש</button>} />
      <SectionTabs />
      <Sheet open={composer} title={editingId ? "עריכת אירוע" : "אירוע חדש"} onClose={() => { setComposer(false); setEditingId(null); setForm(blank); }}>
      <form className="stack" onSubmit={save}>
        <label>
          כותרת
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          תאריך
          <input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
        </label>
        <label>
          שעה
          <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
        </label>
        <details>
          <summary>עוד פרטים</summary>
          <div className="stack">
            <label>
              סוג
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {eventKindOptions(kinds).map((kind) => (
                  <option key={kind.value} value={kind.value}>{kind.label}</option>
                ))}
              </select>
            </label>
            <label>
              קשור ל
              <select value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
                <option value="">בלי שיוך</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label>
              מקום
              <PlaceField value={form.place} onChange={(place) => setForm({ ...form, place })} />
            </label>
            <label>
              הערות
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={form.remind_day_before} onChange={(e) => setForm({ ...form, remind_day_before: e.target.checked })} />
              תזכורת יום לפני
            </label>
            <button className="btn btn-quiet" type="button" onClick={enableReminders}>תזכורת</button>
          </div>
        </details>
        <button className="btn btn-primary" type="submit">{editingId ? "שמירת שינוי" : "שמירה"}</button>
      </form>
      </Sheet>
      {!rows ? <Skeleton rows={3} /> : null}
      {rows && rows.length === 0 ? <Empty title="אין אירועים" action={<button className="btn btn-primary" type="button" onClick={() => setComposer(true)}>אירוע חדש</button>} /> : null}
      {rows && rows.length > 0 ? (
        <div className="tasks-board">
          <EventGroup storageKey="events-today" title="היום" events={todayRows} kinds={kinds} people={people} onEdit={startEdit} onRemove={remove} empty="אין אירועים היום." />
          <EventGroup storageKey="events-later" title="בהמשך" events={laterRows} kinds={kinds} people={people} onEdit={startEdit} onRemove={remove} />
          <EventGroup storageKey="events-past" title="עברו" events={pastRows} kinds={kinds} people={people} onEdit={startEdit} onRemove={remove} defaultOpen={false} />
        </div>
      ) : null}
    </>
  );
}
